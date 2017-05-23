const Promise               = require('bluebird');
const D                     = require('date-fns');
const Liana                 = require('forest-express-sequelize');
const Utils                 = require('../utils');
const {TRASH_SCOPES}        = require('../const');
const {GOOGLE_CALENDAR_IDS} = require('../config');

function checkinoutDateGetter(type) {
  return function() {
    /* eslint-disable no-invalid-this */
    const date = this.dataValues[`${type}Date`];
    /* eslint-enable no-invalid-this */

    return date != null ? Utils.parseDBDate(date) : date;
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
      required: true,
    },
    expectedCheckoutDate:  {
      type:                     DataTypes.DATE,
      required: true,
    },
    price: {
      type:                     DataTypes.INTEGER,
      required: true,
    },
    serviceFees: {
      type:                     DataTypes.INTEGER,
      required: true,
    },
    status: {
      type:                     DataTypes.ENUM('draft', 'active'),
      required: true,
      defaultValue: 'active',
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
      price: Utils.euroRound(( this.price / daysInMonth ) * daysStayed),
      serviceFees: Utils.euroRound(( this.serviceFees / daysInMonth ) * daysStayed),
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

  Renting.prototype.createOrder = function(date = Date.now(), number) {
    const {Order, OrderItem} = models;

    return Order.create({
      type: 'debit',
      label: `${D.format(date, 'MMMM')} Invoice`,
      dueDate: Math.max(Date.now(), D.startOfMonth(this.bookingDate)),
      ClientId: this.ClientId,
      OrderItems: this.toOrderItems(date),
      number,
    }, {
      include: [OrderItem],
    });
  };

  Renting.prototype.findOrCreatePackOrder = function({comfortLevel, discount}, number) {
    const {addressCity} = this.Room.Apartment;

    return Promise.all([
        Utils.getPackPrice(addressCity, comfortLevel),
        Utils.getCheckinPrice(this.get('checkinDate'), comfortLevel),
      ])
      .then(([packPrice, checkinPrice]) => {
        const items = [{
          label: `Housing Pack ${addressCity} ${comfortLevel}`,
          unitPrice: packPrice,
          RentingId: this.id,
          ProductId: `${comfortLevel}-pack`,
        }];

        if ( checkinPrice !== 0 ) {
          items.push({
            label: 'Special checkin',
            unitPrice: checkinPrice,
            ProductId: 'special-checkinout',
          });
        }

        if ( discount != null && discount !== 0 ) {
          items.push({
            label: 'Discount',
            unitPrice: -1 * discount,
            RentingId: this.id,
            ProductId: `${comfortLevel}-pack`,
          });
        }

        return models.Order
          .findOrCreate({
            where: {
              ClientId: this.ClientId,
              label: 'Housing Pack',
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

  Renting.prototype.createRoomSwitchOrder = function({discount}, number) {
    const comfortLevel = this.getComfortLevel();

    return models.Client.scope('roomSwitchCount')
      .findById(this.ClientId)
      .then((client) => {
        return Utils.getRoomSwitchPrice(
          client.get('roomSwitchCount'),
          comfortLevel
        );
      })
      .then((price) => {
        const items = [{
          label: `Room switch ${comfortLevel}`,
          unitPrice: price,
          ProductId: 'room-switch',
        }];

        if (discount != null && discount !== 0 ) {
          items.push({
            label: 'Discount',
            unitPrice: -1 * discount,
            ProductId: 'room-switch',
          });
        }

        return models.Order.create({
          type: 'debit',
          label: 'Room Switch',
          ClientId: this.ClientId,
          OrderItems: items,
          number,
        }, {
          include: [models.OrderItem],
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
            default: {
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
              description: `${firstName} ${lastName},
  ${this.Room.name},
  tel: ${phoneNumber}`,
              eventable: 'Renting',
              EventableId: this.id,
              Terms: [{
                name: 'checkout',
                taxonomy: 'event-category',
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
    return {
      calendarId: GOOGLE_CALENDAR_IDS[this.Apartment.addressCity],
      resource: {
        location: `${this.Apartment.addressStreet}
, ${this.Apartment.addressZip} ${this.Apartment.addressCity},
${this.Apartment.addressCountry}`,
        summary: `${event.category} ${this.Client.firstName} ${this.Client.lastName}`,
        start: { dateTime: this.startDate },
        end: { dateTime: this.endDate },
        description: this.description,
      },
    };
  };

  Renting.hook('beforeValidate', (renting) => {
    // Only calculate the price and fees once!
    if ( renting.price != null ) {
      return renting;
    }

    return models.Room.scope('roomCount')
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

  Renting.beforeLianaInit = (app) => {
    const LEA = Liana.ensureAuthenticated;

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

          return Renting.scope('room+apartment', 'checkinDate').findById(ids[0]);
        })
        .then((renting) => {
          if ( !renting.get('checkinDate') ) {
            throw new Error('Checkin date is required to create the housing-pack order');
          }

          return renting.findOrCreatePackOrder(values);
        })
        .then(Utils.findOrCreateSuccessHandler(res, 'Housing pack order'))
        .catch(Utils.logAndSend(res));

      return null;
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
                .scope('orderItems', 'events', 'room+apartment')
                .findById(ids[0]);
      })
      .then((renting) => {
        if ( !renting.getCheckoutDate() || !renting.getComfortLevel() ) {
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
  };

  return Renting;
};
