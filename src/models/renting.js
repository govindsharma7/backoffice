const Promise               = require('bluebird');
const D                     = require('date-fns');
const Liana                 = require('forest-express-sequelize');
const Utils                 = require('../utils');
const {
  TRASH_SCOPES,
  DEPOSIT_PRICES,
}                           = require('../const');
const {GOOGLE_CALENDAR_IDS} = require('../config');

// TODO: for some reason sqlite seems to return a date in a strange format
// find out why and fix this.
function checkinoutDateGetter(type) {
  return function() {
    /* eslint-disable no-invalid-this */
    const date = this.dataValues[`${type}Date`];
    /* eslint-enable no-invalid-this */

    return date == null || typeof date == 'object' ?
      date : Utils.parseDBDate(date);
  };
}

module.exports = (sequelize, DataTypes) => {
  const {models} = sequelize;
  const Renting = sequelize.define('Renting', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    bookingDate: {
      type:                     DataTypes.DATE,
      required: false,
    },
    expectedCheckoutDate:  {
      type:                     DataTypes.DATE,
      required: false,
    },
    price: {
      type:                     DataTypes.INTEGER,
      required: true,
      allowNull: false,
    },
    serviceFees: {
      type:                     DataTypes.INTEGER,
      required: true,
      allowNull: false,
    },
    status: {
      type:                     DataTypes.ENUM('draft', 'active'),
      required: true,
      defaultValue: 'draft',
      allowNull: false,
    },
    checkinDate: {
      type:                     DataTypes.VIRTUAL,
      get: checkinoutDateGetter('checkin'),
    },
    checkoutDate: {
      type:                     DataTypes.VIRTUAL,
      get: checkinoutDateGetter('checkout'),
    },
  }, {
    paranoid: true,
    scopes: TRASH_SCOPES,
  });

  Renting.associate = () => {
    Renting.belongsTo(models.Client);
    Renting.belongsTo(models.Room);
    Renting.hasMany(models.OrderItem);
    Renting.hasMany(models.Event, {
      foreignKey: 'EventableId',
      constraints: false,
      scope: { eventable: 'Renting' },
    });

    const checkinoutDateScope = (type) => {
      return {
        attributes: { include: [
          [sequelize.col('Events.startDate'), `${type}Date`],
        ]},
        include: [{
          model: models.Event,
          required: false,
          include: [{
            model: models.Term,
            where: {
              taxonomy: 'event-category',
              name: type,
            },
          }],
        }],
      };
    };

    Renting.addScope('events', {
      include: [{
        model: models.Event,
        required: false,
        include: [{
          model: models.Term,
        }],
      }],
    });
    Renting.addScope('checkinDate', checkinoutDateScope('checkin'));
    Renting.addScope('checkoutDate', checkinoutDateScope('checkout'));
    Renting.addScope('eventableRenting', {
      include: [{
        model: models.Room,
        include: [{
          model: models.Apartment,
        }],
      }, {
        model: models.Client,
      }],
    });
    Renting.addScope('client', {
      include: [{
        model: models.Client,
      }],
    });
    Renting.addScope('orders', {
      include: [{
        model: models.Client,
        include: [{
          model: models.Order,
          required: false,
        }],
      }],
    });
    Renting.addScope('room+apartment', {
      include: [{
        model: models.Room,
        include: [{
          model: models.Apartment,
        }],
      }],
    });
    Renting.addScope('orderItems', {
      include: [{
        model: models.OrderItem,
        required: false,
      }],
    });
    Renting.addScope('checkinOrderItem', {
      include: [{
        model: models.OrderItem,
        attributes: ['ProductId'],
        where: { ProductId: { $like: '%-pack' } },
        include: [{
          model: models.Order,
          where: { ninjaId: null },
          include: [{
            model: models.OrderItem,
            required: false,
            where: { ProductId: 'special-checkinout' },
          }],
        }],
      }],
    });
  };

  // Prorate the price and service fees of a renting for a given month
  Renting.prototype.prorate = function(date) {
    const daysInMonth = D.getDaysInMonth(date);
    const startOfMonth = D.startOfMonth(date);
    const endOfMonth = D.endOfMonth(date);
    let daysStayed = daysInMonth;

    if (
      this.bookingDate > endOfMonth ||
      ( this.checkoutDate != null && this.checkoutDate < startOfMonth )
    ) {
      daysStayed = 0;
    }
    else {
      if ( this.bookingDate > startOfMonth ) {
        daysStayed -= D.getDate(this.bookingDate);
      }
      if ( this.checkoutDate != null && this.checkoutDate < endOfMonth ) {
        daysStayed -= daysInMonth - D.getDate(this.checkoutDate);
      }
    }

    return {
      price: Utils.roundBy100(( this.price / daysInMonth ) * daysStayed),
      serviceFees: Utils.roundBy100(( this.serviceFees / daysInMonth ) * daysStayed),
    };
  };

  Renting.prototype.getComfortLevel = function() {
    return ( ( ( this.OrderItems || [] ).find((orderItem) => {
      return /-pack$/.test(orderItem.ProductId);
    }) || {} ).ProductId || '' ).split('-')[0] || null;
  };

  Renting.prototype.toOrderItems = function(date = Date.now()) {
    const prorated = this.prorate(date);
    const room = this.Room;
    const apartment = room.Apartment;
    const month = D.format(date, 'MMMM');

    return [{
      label: `Loyer ${month} - Chambre #${room.reference}`,
      unitPrice: prorated.price,
      RentingId: this.id,
      ProductId: 'rent',
    }, {
      label: `Charges ${month} - Apt #${apartment.reference}`,
      unitPrice: prorated.serviceFees,
      RentingId: this.id,
      ProductId: 'service-fees',
    }];
  };

  //USELESS
  Renting.prototype.createOrder = function(date = Date.now(), number) {
    const {Order, OrderItem} = models;

    return Order.create({
      type: 'debit',
      label: `${D.format(date, 'MMMM')} Invoice`,
      dueDate: Math.max(Date.now(), D.startOfMonth(date)),
      ClientId: this.ClientId,
      OrderItems: this.toOrderItems(date),
      number,
    }, {
      include: [OrderItem],
    });
  };

  Renting.prototype.findOrCreatePackOrder = function({comfortLevel, discount}, number) {
    const {addressCity} = this.Room.Apartment;

    return Utils
      .getPackPrice(addressCity, comfortLevel)
      .then((packPrice) => {
        const items = [{
          label: `Housing Pack ${addressCity} ${comfortLevel}`,
          unitPrice: packPrice,
          RentingId: this.id,
          ProductId: `${comfortLevel}-pack`,
        }];

        if ( discount != null && discount !== 0 ) {
          items.push({
            label: 'Discount',
            unitPrice: -1 * discount,
            RentingId: this.id,
            ProductId: `${comfortLevel}-pack`,
          });
        }
        // We should not add more items to this order. We want to keep the amount
        // as low as possible to avoid turning down customers

        return models.Order
          .findOrCreate({
            where: {
              ClientId: this.ClientId,
              label: 'Housing Pack',
              '$OrderItems.RentingId': this.id,
            },
            defaults: {
              type: 'debit',
              label: 'Housing Pack',
              dueDate: Math.max(Date.now(), D.startOfMonth(this.bookingDate)),
              ClientId: this.ClientId,
              OrderItems: items,
              number,
            },
            include: [models.OrderItem],
          });
        });
  };

  Renting.prototype.findOrCreateDepositOrder = function() {
    const {addressCity} = this.Room.Apartment;

    return models.Order
      .findOrCreate({
        where: {
          ClientId: this.ClientId,
          label: 'Housing Pack',
          '$OrderItems.RentingId': this.id,
        },
        defaults: {
          label: 'Deposit',
          type: 'deposit',
          ClientId: this.id,
          OrderItems: [{
            label: 'Deposit',
            unitPrice: DEPOSIT_PRICES[addressCity],
          }],
        },
      }, {
        include: [models.OrderItem],
    });
  };

  Renting.prototype.createRoomSwitchOrder = function({discount}, number) {
    const comfortLevel = this.getComfortLevel();
    const {Client, Order, OrderItem} = models;

    return Client.scope('roomSwitchCount')
      .findById(this.ClientId)
      .then((client) => {
        return Utils.getRoomSwitchPrice(
          client.get('roomSwitchCount'),
          comfortLevel
        );
      })
      .then((price) => {
        const items = [];

        if ( price !== 0 ) {
          items.push({
            label: `Room switch ${comfortLevel}`,
            unitPrice: price,
            ProductId: 'room-switch',
          });
        }

        if ( discount != null && discount !== 0 ) {
          items.push({
            label: 'Discount',
            unitPrice: -1 * discount,
            ProductId: 'room-switch',
          });
        }

        if ( items.length === 0 ) {
          Order.create({
            label: 'Free Room switch',
            ClientId: this.ClientId,
            number,
            OrderItems: [{
              label: `Room switch ${comfortLevel})`,
              price: 0,
              ProductId: 'room-switch',
            }],
          }, {
            include: [OrderItem],
          });
          throw new Error('This room switch is free, no order was created.');
        }
        return Order.create({
          type: 'debit',
          label: 'Room Switch',
          ClientId: this.ClientId,
          OrderItems: items,
          number,
        }, {
          include: [OrderItem],
        });
      });
  };

  Renting.prototype.findOrCreateCheckoutOrder = function(number) {
    const {Order, OrderItem} = models;
    const {name} = this.Room;

    return Promise.all([
        Utils.getCheckoutPrice(
          this.get('checkoutDate'),
          this.getComfortLevel()
        ),
        Utils.getLateNoticeFees(
          this.get('checkoutDate')
        ),
      ])
      .then(([checkoutPrice, lateNoticeFees]) => {
        const items = [];

        if ( checkoutPrice !== 0 ) {
          items.push({
            label: 'Special checkout',
            unitPrice: checkoutPrice,
            ProductId: 'special-checkinout',
          });
        }
        if ( lateNoticeFees !== 0 ) {
          items.push({
            label: `Late notice ${name}`,
            unitPrice: lateNoticeFees,
            ProductId: 'late-notice',
          });
        }
        if (items.length === 0) {
          throw new Error('This checkout is free, no order was created.');
        }
        return Order
          .findOrCreate({
            where: {
              ClientId: this.ClientId,
              label: 'Checkout',
            },
            defaults: {
              type: 'debit',
              label: 'Checkout',
              ClientId: this.ClientId,
              OrderItems: items,
              number,
            },
            include: [OrderItem],
          });
      });
  };

  Renting.findOrCreateCheckinout = function (type) {
    return function(startDate, options) {
      const {Event, Term} = models;
      /*eslint-disable no-invalid-this */
      const {firstName, lastName, phoneNumber} = this.Client;

      return Utils[`getC${type.substr(1)}EndDate`](startDate, type)
        .then((endDate) => {
          return Event.findOrCreate(Object.assign({
            where: {
              EventableId: this.id,
            },
            include: [{
              model: Term,
              where: {
                name: type,
              },
            }],
            defaults: {
              startDate,
              endDate,
              summary: `${type} ${firstName} ${lastName}`,
              description: `${firstName} ${lastName},
  ${this.Room.name},
  tel: ${phoneNumber}`,
              eventable: 'Renting',
              EventableId: this.id,
              Terms: [{
                name: type,
                taxonomy: 'event-category',
                termable: 'Event',
              }],
            },
          }, options));
        });
      /*eslint-enable no-invalid-this */
    };
  };

  Renting.prototype.findOrCreateCheckout = Renting.findOrCreateCheckinout('checkout');

  Renting.prototype.findOrCreateCheckin = Renting.findOrCreateCheckinout('checkin');

  Renting.prototype.googleSerialize = function(event) {
    const {Apartment} = this.Room;
    const {firstName, lastName} = this.Client;

    return Utils[`getC${event.get('category').substr(1)}EndDate`](
        event.startDate,
        event.get('category')
      )
      .then((endDate) => {
        return {
          calendarId: GOOGLE_CALENDAR_IDS[Apartment.addressCity],
          resource: {
            location: `${Apartment.addressStreet} \
, ${Apartment.addressZip} ${Apartment.addressCity},\
 ${Apartment.addressCountry}`,
            summary: `${event.get('category')} ${firstName} ${lastName}`,
            start: { dateTime: event.startDate },
            end: { dateTime: endDate },
            description: event.description,
          },
        };
      });
  };

  Renting.prototype.handleEventUpdate = function(event) {
    return Renting.scope('checkinOrderItem')
      .findById(this.id)
      .then((renting) => {
        if ( !renting ) {
          throw new Error('Client doesn\'t have a pack order yet');
        }

        return Promise.all([
          Utils.getCheckinPrice(event.startDate, renting.getComfortLevel()),
          renting.OrderItems[0].Order.id,
        ]);
      })
      .then(([checkinPrice, OrderId]) => {
        if ( !checkinPrice ) {
          return models.OrderItem
            .destroy({
              where: {
                ProductId: 'special-checkinout',
                OrderId,
              },
          });
        }
        return models.OrderItem
          .findOrCreate({
            where: {
              label: 'Special checkin',
              unitPrice: checkinPrice,
              ProductId: 'special-checkinout',
              OrderId,
            },
        });
      });
  };

  Renting.hook('beforeValidate', (renting) => {
    // Only calculate the price and fees on creation
    if (
      !( 'RoomId' in renting.dataValues ) ||
      !( 'bookingDate' in renting.dataValues ) ||
      ( renting.price != null && !isNaN(renting.price) )
    ) {
      return renting;
    }

    return models.Room.scope('Room.Apartment')
      .findById(renting.RoomId)
      .then((room) => {
        return room.getCalculatedProps(renting.bookingDate);
      })
      .then(({periodPrice, serviceFees}) => {
        renting.setDataValue('price', periodPrice);
        renting.setDataValue('serviceFees', serviceFees);
        return renting;
      });
  });

  // We want rentings to be draft by default, but users shouldn't have
  // to set the deletedAt value themselves
  Renting.hook('beforeCreate', (renting) => {
    if ( renting.status !== 'active' ) {
      renting.setDataValue('deletedAt', Date.now());
    }

    return renting;
  });

  Renting.beforeLianaInit = (app) => {
    const LEA = Liana.ensureAuthenticated;

    // NORMALLY THIS IS USELESS BECAUSE RENT ORDERS ARE GENERATE BY A SCRIPT
    app.post('/forest/actions/create-rent-order', LEA, (req, res) => {
      const {ids} = req.body.data.attributes;

      Promise.resolve()
        .then(() => {
          if ( ids.length > 1 ) {
            throw new Error('Can\'t create multiple rent orders');
          }

          return Renting.scope('room+apartment', 'checkoutDate').findById(ids[0]);
        })
        .then((renting) => {
          return renting.createOrder();
        })
        .then(Utils.createSuccessHandler(res, 'Renting Order'))
        .catch(Utils.logAndSend(res));

      return null;
    });

    app.post('/forest/actions/create-pack-order', LEA, (req, res) => {
      const {values, ids} = req.body.data.attributes;

      if ( values.discount != null ) {
        values.discount *= 100;
      }

      Promise.resolve()
        .then(() => {
          if ( !values.comfortLevel ) {
            throw new Error('Please select a comfort level');
          }
          if ( ids.length > 1 ) {
            throw new Error('Can\'t create multiple housing-pack orders');
          }

          return Renting.scope('room+apartment').findById(ids[0]);
        })
        .then((renting) => {
          return renting.findOrCreatePackOrder(values);
        })
        .then(Utils.findOrCreateSuccessHandler(res, 'Housing pack order'))
        .catch(Utils.logAndSend(res));

      return null;
    });

    app.post('/forest/actions/create-deposit-order', LEA, (req, res) => {
      const {ids} = req.body.data.attributes;

      Promise.resolve()
        .then(() => {
          if ( ids.length > 1 ) {
            throw new Error('Can\'t create multiple deposit order');
          }

          return Renting.scope('room+apartment').findById(ids[0]);
        })
        .then((renting) => {
          return renting.findOrCreateDepositOrder();
        })
        .then(Utils.createSuccessHandler(res, 'Deposit order'))
        .catch(Utils.logAndSend(res));
    });

    app.post('/forest/actions/add-checkout-date', LEA, (req, res) => {
      const {values, ids} = req.body.data.attributes;

      Promise.resolve()
      .then(() => {
        if ( !values.plannedDate ) {
          throw new Error('Please select a planned date');
        }
        if ( ids.length > 1 ) {
          throw new Error('Can\'t create multiple checkout events');
        }

        return Renting.scope('room+apartment', 'events', 'client').findById(ids[0]);
      })
      .then((renting) => {
        return renting.findOrCreateCheckout(values.plannedDate);
      })
      .then(Utils.findOrCreateSuccessHandler(res, 'Checkout event'))
      .catch(Utils.logAndSend(res));

      return null;
    });

    app.post('/forest/actions/add-checkin-date', LEA, (req, res) => {
      const {values, ids} = req.body.data.attributes;

      Promise.resolve()
      .then(() => {
        if ( !values.plannedDate ) {
          throw new Error('Please select a planned date');
        }
        if ( ids.length > 1 ) {
          throw new Error('Can\'t create multiple checkin events');
        }
        return Renting.scope('room+apartment', 'events', 'client').findById(ids[0]);
      })
      .then((renting) => {
        return renting.findOrCreateCheckin(values.plannedDate);
      })
      .then(Utils.findOrCreateSuccessHandler(res, 'Checkin event'))
      .catch(Utils.logAndSend(res));

      return null;
    });

    app.post('/forest/actions/create-checkout-order', LEA, (req, res) => {
      const {ids} = req.body.data.attributes;

      Promise.resolve()
      .then(() => {
        if ( ids.length > 1 ) {
          throw new Error('Can\'t create multiple checkout orders');
        }
        return Renting
                .scope('orderItems', 'events', 'room+apartment', 'checkoutDate')
                .findById(ids[0]);
      })
      .then((renting) => {
        if ( !renting.get('checkoutDate') || !renting.getComfortLevel() ) {
          throw new Error(
            'Checkout and housing pack are required to create checkout order'
          );
        }
        return renting.findOrCreateCheckoutOrder();
      })
      .then(Utils.findOrCreateSuccessHandler(res, 'Checkout order'))
      .catch(Utils.logAndSend(res));

      return null;
    });

    app.post('/forest/actions/room-switch-order', LEA, (req, res) => {
      const {ids, values} = req.body.data.attributes;

      if ( values.discount != null ) {
        values.discount *= 100;
      }

      Promise.resolve()
      .then(() => {
        if ( ids.length > 1 ) {
          throw new Error('Can\'t create multiple room switch orders');
        }
        return Renting.scope('orders', 'orderItems').findById(ids[0]);
      })
      .then((renting) => {
        if ( !renting.getComfortLevel() ) {
          throw new Error('Housing pack is required to create room switch order');
        }
        return renting.createRoomSwitchOrder(values);
      })
      .then(Utils.createSuccessHandler(res, 'Room switch order'))
      .catch(Utils.logAndSend(res));

      return null;
    });

    Utils.addRestoreAndDestroyRoutes(app, Renting);
  };

  return Renting;
};
