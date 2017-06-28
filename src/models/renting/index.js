const Promise               = require('bluebird');
const D                     = require('date-fns');
const capitalize            = require('lodash/capitalize');
const Utils                 = require('../../utils');
const {
  TRASH_SCOPES,
  DEPOSIT_PRICES,
  DEPOSIT_REFUND_DELAYS,
}                           = require('../../const');
const {GOOGLE_CALENDAR_IDS} = require('../../config');
const routes                = require('./routes');

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
    Renting.addScope('client', {
      include: [{
        model: models.Client,
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
    });

    Renting.addScope('comfortLevel', {
      attributes: [
        [sequelize.fn('replace', sequelize.col('OrderItems.ProductId'), '-pack', ''),
        'comfortLevel'],
        'id',
        'ClientId'],
      include: [{
        model: models.OrderItem,
        required: false,
        where: { ProductId: { $like: '%-pack' } },
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
    Renting.addScope('room', {
      include: [{
        model: models.Room,
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

  // NORMALLY THIS IS USELESS BECAUSE RENT ORDERS ARE GENERATED BY A SCRIPT
  Renting.prototype.createRentOrder = function(date = Date.now(), number) {
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
      });
  };

  // this function finds or creates checkin and checkout Order,
  // if it's a checkout order, it also creates a refund event
  ['checkin', 'checkout'].forEach((type) => {
    Renting.prototype[`findOrCreate${_.capitalize(type)}Order`] =
      function(number) {
        return Promise.all([
            Utils[`get${_.capitalize(type)}Price`](
              this.get(`${type}Date`),
              this.get('comfortLevel')
            ),
            Utils.getLateNoticeFees(type, this.get(`${type}Date`)),
          ])
          .then(([price, lateNoticeFees]) => {
            const ProductId = `special-${type}`;
            const items = [
              {
                label: `${price !== 0 ? 'Special' : 'Free' } ${type}`,
                unitPrice: price,
                RentingId: this.id,
                ProductId,
              },
              lateNoticeFees !== 0 && {
                label: `Late notice ${this.Room.name}`,
                unitPrice: lateNoticeFees,
                RentingId: this.id,
                ProductId: 'late-notice',
              },
            ].filter(Boolean);

            return models.Order
              .findItemOrCreate({
                where: {
                  RentingId: this.id,
                  ProductId,
                },
                defaults: {
                  type: 'debit',
                  label: _.capitalize(type),
                  ClientId: this.ClientId,
                  OrderItems: items,
                  number,
                },
              });
          });
      };
  });

  Renting.prototype.createRoomSwitchOrder = function({discount}, number) {
    const comfortLevel = this.get('comfortLevel');

    return models.Client.scope('roomSwitchCount')
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

        return models.Order.create({
          type: 'debit',
          label: items.length > 0 ? 'Room switch' : 'Free Room switch',
          ClientId: this.ClientId,
          OrderItems: items.length > 0 ? items : [{
            label: `Room switch ${comfortLevel})`,
            unitPrice: 0,
            ProductId: 'room-switch',
          }],
          number,
        }, { include: [models.OrderItem] });
      });
  };

  Renting.prototype.createOrUpdateRefundEvent = function(date, transaction) {
    const {name} = this.Room;
    const {firstName, lastName} = this.Client;
    const startDate = D.addDays(date, DEPOSIT_REFUND_DELAYS[this.get('comfortLevel')]);
    const category = 'refund-deposit';

//    return sequelize.transaction((transaction) => {
      //Using event-category scope result in no column 'Terms.name' in subquery
      return models.Event
        .findOne({
          where: {
            EventableId: this.id,
          },
          include: [{
            model: models.Term,
            where: {
              name: category,
            },
          }],
          transaction,
        })
        .then((event) => {
          if ( event ) {
            return event.update({ startDate, endDate: startDate }, {transaction});
          }
          return models.Event.create({
            startDate,
            endDate: startDate,
            summary: `Refund deposit ${firstName} ${lastName}`,
            description: `${name}`,
            eventable: 'Renting',
            EventableId: this.id,
            Terms: [{
              name: 'refund-deposit',
              taxonomy: 'event-category',
              termable: 'Event',
            }],
          }, {
            include: [models.Term],
            transaction,
          });
        });
//    });
  };

  // #findOrCreateCheckinEvent and #findOrCreateCheckoutEvent
  ['checkin', 'checkout'].forEach((type) => {
    Renting.prototype[`findOrCreate${_.capitalize(type)}Event`] =
      function(startDate, options) {
        const {firstName, lastName, phoneNumber} = this.Client;
        const roomName = this.Room.name;
        const term = {
          name: type,
          taxonomy: 'event-category',
          termable: 'Event',
        };

        return Utils[`get${_.capitalize(type)}EndDate`](startDate)
          .then((endDate) => {
            // TODO: test that this findOrCreate actually works
            return models.Event.findOrCreate(Object.assign({
              where: {
                EventableId: this.id,
              },
              include: [{
                model: models.Term,
                where: term,
              }],
              defaults: {
                startDate,
                endDate,
                summary: `${type} ${firstName} ${lastName}`,
                description: Utils.stripIndent(`\
                  ${firstName} ${lastName},
                  ${roomName},
                  tel: ${phoneNumber || 'N/A'}`),
                eventable: 'Renting',
                EventableId: this.id,
                Terms: [term],
              },
            }, options));
          });
      };
  });

  Renting.prototype.googleSerialize = function(event) {
    const {Apartment} = this.Room;
    const isRefundDeposit = event.get('category') === 'refund-deposit';

    return {
      calendarId: GOOGLE_CALENDAR_IDS[
        isRefundDeposit ? 'refund-deposit' : Apartment.addressCity
      ],
      resource: isRefundDeposit && {
        location: Utils.stripIndent(`\
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
  // TODO: this can probably be improved as well
  Renting.handleEventUpdate = function(event, eventableId, transaction) {
    const type = event.get('category');

    return Renting.scope('comfortLevel', 'eventableRenting')
      .findById(eventableId)
      .then((renting) => {
        return Promise.all([
          renting,
          Utils[`get${_.capitalize(type)}Price`](
            event.startDate,
            renting.get('comfortLevel')),
          Utils.getLateNoticeFees(type, event.startDate),
          models.Order
            .findOrCreate(Object.assign({
              where: {
                ClientId: renting.ClientId,
                label: `${_.capitalize(type)}`,
              },
              defaults: {
                type: 'debit',
                label: `${_.capitalize(type)}`,
                ClientId: renting.ClientId,
              },
            }, {transaction})),
        ]);
      })
      .tap(([, price, lateFees, [order]]) => {
        if ( price === 0 && lateFees === 0 ) {
          return models.Order
            .destroy({
              where: {
                id: order.id,
              },
              transaction,
            });
        }
        return true;
      })
      .tap(([renting, price, , [order]]) => {
        if ( price !== 0 ) {
          return models.OrderItem
            .findOrCreate({
              where: {
                RentingId: renting.id,
                ProductId: `special-${type}`,
                OrderId: order.id,
              },
              defaults: {
                label: `Special ${_.capitalize(type)}`,
                unitPrice: price,
                RentingId: renting.id,
                ProductId: `special-${type}`,
                OrderId: order.id,
              },
              transaction,
           });
        }
        return models.OrderItem
          .destroy({
            where: {
              OrderId: order.id,
              ProductId: `special-${type}`,
              RentingId: renting.id,
            },
            transaction,
          });
      })
      .tap(([renting, , lateFees, [order]]) => {
        if ( lateFees !== 0 ) {
          return models.OrderItem
            .findOrCreate({
              where: {
                RentingId: renting.id,
                ProductId: 'late-notice',
                OrderId: order.id,
              },
              defaults: {
                label: `Late notice ${renting.Room.name}`,
                unitPrice: lateFees,
                RentingId: renting.id,
                ProductId: 'late-notice',
                OrderId: order.id,
              },
              transaction,
            });
        }
        return models.OrderItem
          .destroy({
          where: {
            OrderId: order.id,
            ProductId: 'late-notice',
            RentingId: renting.id,
          },
          transaction,
        });
      })
      .then(([renting]) => {
        if ( type === 'checkout' ) {
          return renting.createOrUpdateRefundEvent(event.startDate, transaction);
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

  Renting.beforeLianaInit = routes;

  return Renting;
};
