const Promise               = require('bluebird');
const D                     = require('date-fns');
const capitalize            = require('lodash/capitalize');
const Liana                 = require('forest-express-sequelize');
const stripIndent           = require('strip-indent');
const Utils                 = require('../utils');
const {
  TRASH_SCOPES,
  DEPOSIT_PRICES,
  DEPOSIT_REFUND_DELAYS,
}                           = require('../const');
const {GOOGLE_CALENDAR_IDS} = require('../config');

const _ = { capitalize };

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

    Renting.addScope('events', {
      include: [{
        model: models.Event,
        required: false,
        include: [{
          model: models.Term,
        }],
      }],
    });
    // checkinDate, checkoutDate, checkinEvent, checkoutEvent scopes
    ['checkin', 'checkout'].forEach((type) => {
      Renting.addScope(`${type}Date`, {
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
      });
      Renting.addScope(`${type}Event`, {
        include: [{
          model: models.Client,
          include: [{
            model: models.Order,
            required: false,
            where: { label: _.capitalize(type) },
          }],
        }],
      });
    });
    Renting.addScope('orderItems', {
      include: [{
        model: models.OrderItem,
      }],
    });
    Renting.addScope('eventableRenting', {
      include: [{
        model: models.Room,
        include: [{
          model: models.Apartment,
        }],
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

    Renting.addScope('client', {
      include: [{
        model : models.Client,
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
    const ProductId = `${comfortLevel}-pack`;

    return Utils
      .getPackPrice(addressCity, comfortLevel)
      .then((packPrice) => {
        return models.Order
          .findItemOrCreate({
            where: {
              RentingId: this.id,
              ProductId,
            },
            defaults: {
              type: 'debit',
              label: 'Housing Pack',
              dueDate: Math.max(Date.now(), D.startOfMonth(this.bookingDate)),
              ClientId: this.ClientId,
              OrderItems: [
                {
                  label: `Housing Pack ${addressCity} ${comfortLevel}`,
                  unitPrice: packPrice,
                  RentingId: this.id,
                  ProductId,
                },
                discount != null && discount !== 0 && {
                  label: 'Discount',
                  unitPrice: -1 * discount,
                  RentingId: this.id,
                  ProductId,
                },
                // We should not add more items to this order. We want to keep the amount
                // as low as possible to avoid turning down customers
              ].filter(Boolean),
              number,
            },
          });
        })
        .then(([order, isCreated]) => {
          if ( !isCreated ) {
            throw new Error('Pack order already exists for this renting');
          }

          return order;
        });
  };

  Renting.prototype.findOrCreateDepositOrder = function(number) {
    const {addressCity} = this.Room.Apartment;
    const ProductId = `${addressCity}-deposit`;

    return models.Order
      .findItemOrCreate({
        where: {
          RentingId: this.id,
          ProductId,
        },
        defaults: {
          label: 'Deposit',
          type: 'deposit',
          ClientId: this.ClientId,
          OrderItems: [{
            label: 'Deposit',
            unitPrice: DEPOSIT_PRICES[addressCity],
            RentingId: this.id,
            ProductId,
          }],
          number,
        },
      })
      .then(([order, isCreated]) => {
        if ( !isCreated ) {
          throw new Error('Deposit order already exists for this renting');
        }

        return order;
      });
  };

  Renting.prototype.createRoomSwitchOrder = function({discount}, number) {
    const comfortLevel = this.getComfortLevel();
    const {Client, Order, OrderItem} = models;

    return Client.scope('roomSwitchCount')
      .findById(this.ClientId)
      .then((client) => {
        return Utils.getRoomSwitchPrice( client.get('roomSwitchCount'), comfortLevel );
      })
      .then((price) => {
        const items = [
          price !== 0 && {
            label: `Room switch ${comfortLevel}`,
            unitPrice: price,
            ProductId: 'room-switch',
          },
          discount != null && discount !== 0 && {
            label: 'Discount',
            unitPrice: -1 * discount,
            ProductId: 'room-switch',
          },
        ].filter(Boolean);

        return Order.create({
          type: 'debit',
          label: items.length > 0 ? 'Room switch' : 'Free Room switch',
          ClientId: this.ClientId,
          OrderItems: items.length > 0 ? items : [{
            label: `Room switch ${comfortLevel})`,
            unitPrice: 0,
            ProductId: 'room-switch',
          }],
          number,
        }, { include: [OrderItem] });
      });
  };

  Renting.prototype.findOrCreateRefundEvent = function(date, options) {
    const {Event, Term} = models;
    const {name} = this.Room;
    const {firstName, lastName} = this.Client;

    return Event
      .findOrCreate(Object.assign({
        where: {
          EventableId: this.id,
        },
        include: [{
          model: Term,
          where: {
            name: 'refund_deposit',
          },
        }],
        defaults: {
          startDate: D.addDays(
            date,
            DEPOSIT_REFUND_DELAYS[this.getComfortLevel()]),
          endDate: D.addDays(
            date,
            DEPOSIT_REFUND_DELAYS[this.getComfortLevel()]),
          summary: `refund deposit ${firstName} ${lastName}`,
          description: `${name}`,
          eventable: 'Renting',
          EventableId: this.id,
          Terms: [{
            name: 'refund_deposit',
            taxonomy: 'event-category',
            termable: 'Event',
          }],
        },
      }, options))
      .then(([model, isCreated]) => {
        if ( !isCreated ) {
          return model.update({
            startDate: D.addDays(
              date,
              DEPOSIT_REFUND_DELAYS[this.getComfortLevel()]),
            endDate: D.addDays(
              date,
              DEPOSIT_REFUND_DELAYS[this.getComfortLevel()]),
            });
        }
        return true;
      });
  };

  /*  this function find or create checkin and checkout Order,
      if it's a checkout event, it also create a refund event
  */
  Renting.findOrCreateCheckinoutOrder = function(type) {
    return function(number, options) {
      /*eslint-disable no-invalid-this */
      const {Order, OrderItem} = models;


      return Promise.all([
          Utils[`getC${type.substr(1)}Price`](
            this.get(`${type}Date`),
            this.getComfortLevel()
          ),
          type === 'checkout' ?
            Utils.getLateNoticeFees(this.get(`${type}Date`)) : 0,
        ])
        .then(([price, lateNoticeFees]) => {
          const items = [];

          if ( price !== 0 ) {
            items.push({
              label: `Special ${type}`,
              unitPrice: price,
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
            throw new Error(`This ${type} is free, no order was created.`);
          }
          return Order
            .findOrCreate({
              where: {
                ClientId: this.ClientId,
                label: `C${type.substr(1)}`,
              },
              defaults: {
                type: 'debit',
                label: `C${type.substr(1)}`,
                ClientId: this.ClientId,
                OrderItems: items,
                number,
              },
              include: [OrderItem],
            });
        })
        .tap(() => {
          if ( type === 'checkout' ) {
            this.findOrCreateRefundEvent(this.get('checkoutDate'), options);
          }

          return true;
        })
        .then(([instance, isCreated]) => {
          return [instance, isCreated];
        });
    /*eslint-enable no-invalid-this */
    };
  };

  // #findOrCreateCheckinEvent and #findOrCreateCheckoutEvent
  ['checkin', 'checkout'].forEach((type) => {
    Renting.prototype[`findOrCreate${_.capitalize(type)}Event`] =
      function(startDate, options) {
        const {Event, Term} = models;
        const {firstName, lastName, phoneNumber} = this.Client;

        return Utils[`get${_.capitalize(type)}EndDate`](startDate)
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
                description: stripIndent(`\
                  ${firstName} ${lastName},
                  ${this.Room.name},
                  tel: ${phoneNumber || 'N/A'}`),
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
      };
  });

  Renting.prototype.googleSerialize = function(event) {
    const {Apartment} = this.Room;
    const isRefundDeposit = event.get('category') === 'refund_deposit';

    return {
      calendarId: GOOGLE_CALENDAR_IDS[isRefundDeposit ?
        'refund_deposit' : Apartment.addressCity
      ],
      resource: isRefundDeposit && {
        location: stripIndent(`\
          ${Apartment.addressStreet}, \
          ${Apartment.addressZip} ${Apartment.addressCity}, \
          ${Apartment.addressCountry}`),
      },
    };
  };

  /*  handle update of an event, check if an Order
      is related to this event and create/update it
      Also update/create Refund Event if it's a 'Checkout' Event
  */
  Renting.prototype.handleEventUpdate = function(event, type, options) {
    return Renting.scope(type === 'refund_deposit' ? 'client' : `${type}Order`)
      .findById(this.id)
      .then((renting) => {
        if ( !renting ) {
          throw new Error('Client doesn\'t have a pack order yet');
        }
        const {Orders} = renting.Client === undefined || null ? null : renting.Client;

        return Promise.all([
            type !== 'refund_deposit' ? Utils[`getC${type.substr(1)}Price`](
              event.startDate,
              this.getComfortLevel()) : 0,
            Orders && Orders.length ? Orders[0].id : null,
            type === 'checkout' ?
            Utils.getLateNoticeFees(event.startDate) : 0,
        ]);
      })
      .then(([price, OrderId, lateFees]) => {
        if ( !price && !lateFees ) {
          return models.Order
            .destroy({
              where: {
                id: OrderId,
              },
          });
        }
        const items = [];

        if ( price ) {
          items.push({
            label: `Special C${type.substr(1)}`,
            unitPrice: price,
            ProductId: 'special-checkinout',
          });
        }
        else {
          models.OrderItem
            .destroy({
              where: {
                OrderId,
                ProductId: 'special-checkinout',
              },
            });
        }
        if ( lateFees ) {
          items.push({
            label: `Late notice ${this.Room.name}`,
            unitPrice: lateFees,
            ProductId: 'late-notice',
          });
        }
        else {
          models.OrderItem
            .destroy({
              where: {
                OrderId,
                ProductId: 'late-notice',
              },
            });
        }

        return models.Order
         .findOrCreate({
              where: {
                ClientId: this.ClientId,
                label: `C${type.substr(1)}`,
              },
              defaults: {
                type: 'debit',
                label: `C${type.substr(1)}`,
                ClientId: this.ClientId,
                OrderItems: items,
              },
              include: [models.OrderItem],
            });
      })
      .then(() => {
        if ( type === 'checkout' ) {
          return this.findOrCreateRefundEvent(event.startDate, options);
        }
        return true;
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

    return models.Room.scope('Apartment')
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

    // NORMALLY THIS IS USELESS BECAUSE RENT ORDERS ARE GENERATED BY A SCRIPT
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

    // add-checkin-date and add-checkout-date routes
    ['checkin', 'checkout'].forEach((type) => {
      app.post(`/forest/actions/add-${type}-date`, LEA, (req, res) => {
        const {values, ids} = req.body.data.attributes;

        Promise.resolve()
        .then(() => {
          if ( !values.dateAndTime ) {
            throw new Error('Please select a planned date');
          }
          if ( ids.length > 1 ) {
            throw new Error(`Can't create multiple ${type} events`);
          }
          return Renting.scope('room+apartment', 'events', 'client').findById(ids[0]);
        })
        .then((renting) => {
<<<<<<< HEAD
          return renting[`findOrCreate${_.capitalize(type)}`](values.dateAndTime);
=======
          return renting[`findOrCreate${_.capitalize(type)}Event`](values.plannedDate);
>>>>>>> renting smart action "Create Checkin Order"
        })
        .then(Utils.findOrCreateSuccessHandler(res, `${type} event`))
        .catch(Utils.logAndSend(res));

        return null;
      });
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
    Utils.addCheckinoutDateRoutes(app, Renting, 'checkin');
    Utils.addCheckinoutDateRoutes(app, Renting, 'checkout');
  };

  return Renting;
};
