const Promise               = require('bluebird');
const D                     = require('date-fns');
const capitalize            = require('lodash/capitalize');
const find                  = require('lodash/find');
const Webmerge              = require('../../vendor/webmerge');
const Utils                 = require('../../utils');
const {
  TRASH_SCOPES,
  DEPOSIT_PRICES,
}                           = require('../../const');
const {
  GOOGLE_CALENDAR_IDS,
  NODE_ENV,
  WEBMERGE_DOCUMENT_ID,
  WEBMERGE_DOCUMENT_KEY,
}                           = require('../../config');
const routes                = require('./routes');

const _ = { capitalize, find };

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
    Renting.hasMany(models.Term, {
      foreignKey: 'TermableId',
      constraints: false,
      scope: { termable: 'Renting' },
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
      attributes: [[
        sequelize.fn('replace', sequelize.col('ProductId'), '-pack', ''),
        'comfortLevel',
      ]],
      include: [{
        model: models.OrderItem,
        required: false,
        where: { ProductId: { $like: '%-pack' } },
      }],
    });
    Renting.addScope('leaseVersion', {
      attributes: [
        [sequelize.fn('ifnull', sequelize.col('Term.name'), 'v1'), 'leaseVersion'],
      ],
      include: [{
        model: models.Term,
        where: { taxonomy: 'lease-version' },
      }],
    });
    Renting.addScope('Room+Apartment', {
      include: [{
        model: models.Room,
        include: [{
          model: models.Apartment,
        }],
      }],
    });
    Renting.addScope('Client+Metadata', {
      include: [{
        model: models.Client,
        include: [{
          model: models.Metadata,
        }],
      }],
    });
  };

  // Prorate the price and service fees of a renting for a given month
  Renting.prototype.prorate = function(date) {
    return this.requireScopes(['checkoutDate'])
      .then(() => {
        const daysInMonth = D.getDaysInMonth(date);
        const startOfMonth = D.startOfMonth(date);
        const endOfMonth = D.endOfMonth(date);
        const checkoutDate = this.get('checkoutDate');
        let daysStayed = daysInMonth;

        if (
          this.bookingDate > endOfMonth ||
          ( checkoutDate != null && checkoutDate < startOfMonth )
        ) {
          daysStayed = 0;
        }
        else {
          if ( this.bookingDate > startOfMonth ) {
            daysStayed -= D.getDate(this.bookingDate) - 1;
          }
          if ( checkoutDate != null && checkoutDate < endOfMonth ) {
            daysStayed -= daysInMonth - D.getDate(checkoutDate);
          }
        }

        return {
          price: Utils.roundBy100(( this.price / daysInMonth ) * daysStayed),
          serviceFees: Utils.roundBy100(( this.serviceFees / daysInMonth ) * daysStayed),
        };
      });
  };

  Renting.prototype.toOrderItems = function(date = Date.now()) {
    return this.requireScopes(['Room+Apartment', 'checkoutDate'])
      .then(() => {
        return this.prorate(date);
      })
      .then((prorated) => {
        const month = D.format(date, 'MMMM');

        return [{
          label: `Loyer ${month} - Chambre #${this.Room.reference}`,
          unitPrice: prorated.price,
          RentingId: this.id,
          ProductId: 'rent',
        }, {
          label: `Charges ${month} - Apt #${this.Room.Apartment.reference}`,
          unitPrice: prorated.serviceFees,
          RentingId: this.id,
          ProductId: 'service-fees',
        }];
      });
  };

  // NORMALLY THIS IS USELESS BECAUSE RENT ORDERS ARE GENERATED BY A SCRIPT
  Renting.prototype.createRentOrder = function(date = Date.now(), number) {
    return this
      .toOrderItems(date)
      .then((OrderItems) => {
        return models.Order.create({
          type: 'debit',
          label: `${D.format(date, 'MMMM')} Invoice`,
          dueDate: Math.max(Date.now(), D.startOfMonth(date)),
          ClientId: this.ClientId,
          OrderItems,
          number,
        }, {
          include: [models.OrderItem],
        });
      });
  };

  Renting.prototype.findOrCreatePackOrder = function({comfortLevel, discount}, number) {
    return this.requireScopes(['Room+Apartment'])
      .then(() => {
        return Utils.getPackPrice(this.Room.Apartment.addressCity, comfortLevel);
      })
      .then((packPrice) => {
        const {addressCity} = this.Room.Apartment;
        const ProductId = `${comfortLevel}-pack`;

        return models.Order.findItemOrCreate({
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
    return this.requireScopes(['Room+Apartment'])
      .then(() => {
        const {addressCity} = this.Room.Apartment;
        const ProductId = `${addressCity}-deposit`;

        return models.Order.findItemOrCreate({
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
      });
  };

  // this function finds or creates checkin and checkout Order,
  // if it's a checkout order, it also creates a refund event
  ['checkin', 'checkout'].forEach((type) => {
    Renting.prototype[`findOrCreate${_.capitalize(type)}Order`] = function(number) {
      return this.requireScopes([`${type}Date`, 'comfortLevel', 'leaseVersion'])
        .then(() => {
          return Promise.all([
            Utils[`get${_.capitalize(type)}Fees`](
              this.get(`${type}Date`),
              this.get('comfortLevel'),
              this.get('leaseVersion'),
            ),
            Utils.getLateNoticeFees(
              type,
              this.get(`${type}Date`),
              this.get('leaseVersion')
            ),
          ]);
        })
        .then(([price, lateNoticeFees]) => {
          const ProductId = `special-${type}`;

          return models.Order.findItemOrCreate({
            where: {
              RentingId: this.id,
              ProductId,
            },
            defaults: {
              type: 'debit',
              label: _.capitalize(type),
              ClientId: this.ClientId,
              OrderItems: [
                {
                  label: `${price !== 0 ? 'Special' : 'Free' } ${type}`,
                  unitPrice: price,
                  RentingId: this.id,
                  ProductId,
                },
                lateNoticeFees !== 0 && {
                  label: `Late notice ${name}`,
                  unitPrice: lateNoticeFees,
                  RentingId: this.id,
                  ProductId: 'late-notice',
                },
              ].filter(Boolean),
              number,
            },
          });
        });
      };
  });

  Renting.prototype.createRoomSwitchOrder = function({discount}, number) {
    return Promise.all([
        this.requireScopes(['comfortLevel', 'leaseVersion']),
        models.Client.scope('roomSwitchCount').findById(this.ClientId),
      ])
      .then(([, client]) => {
        return Utils.getRoomSwitchFees(
          client.get('roomSwitchCount'),
          this.get('comfortLevel'),
          this.get('leaseVersion')
        );
      })
      .then((price) => {
        const items = [
          price !== 0 && {
            label: `Room switch ${this.get('comfortLevel')}`,
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
            label: `Room switch ${this.get('comfortLevel')})`,
            unitPrice: 0,
            ProductId: 'room-switch',
          }],
          number,
        }, { include: [models.OrderItem] });
      });
  };

  Renting.prototype.createOrUpdateRefundEvent = function(date) {
    return this.requireScopes(['Room', 'comfortLevel', 'leaseVersion'])
      .then(() => {
        return Utils.getRefundDate(
          date,
          this.get('comfortLevel'),
          this.get('leaseVersion')
        );
      })
      .then((startDate) => {
        const {name} = this.Room;
        const {firstName, lastName} = this.Client;
        const category = 'refund-deposit';

        /* eslint-disable promise/no-nesting */
        return sequelize.transaction((transaction) => {
          return models.Event.scope('event-category')
            .findOne({
              where: {
                EventableId: this.id,
                category,
              },
              transaction,
            })
            .then((event) => {
              if ( event ) {
                return event.update({ startDate, endDate: startDate }, transaction);
              }

              return models.event.create({
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
              }, { transaction });
            });
        });
        /* eslint-enable promise/no-nesting */
      });
  };

  // #findOrCreateCheckinEvent and #findOrCreateCheckoutEvent
  ['checkin', 'checkout'].forEach((type) => {
    Renting.prototype[`findOrCreate${_.capitalize(type)}Event`] =
      function(startDate, options) {
        return Promise.all([
            this.requireScopes(['Room', 'Client']),
            Utils[`get${_.capitalize(type)}EndDate`](startDate),
          ])
          .then(([, endDate]) => {
            const {firstName, lastName, phoneNumber} = this.Client;
            const roomName = this.Room.name;
            const term = {
              name: type,
              taxonomy: 'event-category',
              termable: 'Event',
            };

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

  Renting.prototype.changeDepositOption = function(option) {
    return models.Term.build({
        taxonomy: 'deposit-option',
        termable: 'Renting',
        TermableId: this.id,
      }, {isNewRecord: false})
      .createOrUpdate(option === 'cash deposit' ? 'cash' : 'do-not-cash');
  };

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

  Renting.prototype.generateLease = function() {
    return this
      .requireScopes(['Client+Metadata', 'Room+Apartment', 'comfortLevel'])
      .then(() => {
        return Utils.getDepositPrice(this.Room.Apartment.addressCity);
      })
      .then(() => {
        const {Client: {Metadata}, Room} = this;
        const {Apartment} = Room;
        const {addressStreet, addressZip, addressCity} = Apartment;

        return Webmerge.mergeDocument(WEBMERGE_DOCUMENT_ID, WEBMERGE_DOCUMENT_KEY, {
          fullName: `${this.firstName} ${this.lastName}`,
          fullAddress: _.find(Metadata, {name: 'fullAddress'}).value,
          birthDate: _.find(Metadata, {name: 'birthDate'}).value,
          birthPlace: _.find(Metadata, {name: 'birthPlace'}).value,
          nationality: _.find(Metadata, {name: 'nationality'}).value,
          floorArea: Apartment.floorArea,
          address: `${addressStreet}, ${addressZip}, ${addressCity}`,
          floor: Apartment.floor === 0 ? 'rez-de-chausée' : Apartment.floor,
          code: Apartment.code ? Apartment.code : 'néant',
          rent: this.price / 100,
          serviceFees: this.serviceFees / 100,
          bookingDate: this.bookingDate,
          endDate: D.addYears(D.subDays(this.bookingDate, 1), 1),
          deposit: Utils.getDepositPrice(addressCity) / 100,
          packLevel: this.get('comfortLevel'),
          roomFloorArea: Room.floorArea,
          apartmentRoomNumber: Apartment.roomCount,
          roomNumber: Room.reference.slice(-1),
          email: this.email,
        // the last param turns on the test environment of webmerge
        }, NODE_ENV !== 'production');
      });
  };

  /*  handle update of an event, check if an Order
      is related to this event and create/update it
      Also update/create Refund Event if it's a 'Checkout' Event
  */
  // TODO: this can probably be improved as well
  Renting.prototype.handleEventUpdate = function(event, options) {
    const type = event.get('category');

    return Renting.scope(type === 'refund-deposit' ? 'Client' : `${type}Order`)
      .findById(this.id)
      .then((renting) => {
        if ( !renting ) {
          throw new Error('Client doesn\'t have a pack order yet');
        }
        const {Orders} = renting.Client === undefined || null ? null : renting.Client;

        return Promise.all([
            type !== 'refund-deposit' ? Utils[`get${_.capitalize(type)}Fees`](
              event.startDate,
              this.getComfortLevel()) : 0,
            Orders && Orders.length ? Orders[0].id : null,
            Utils.getLateNoticeFees(type, event.startDate),
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
          return this.createOrUpdateRefundEvent(event.startDate, options);
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
