const Promise               = require('bluebird');
const D                     = require('date-fns');
const capitalize            = require('lodash/capitalize');
const values                = require('lodash/values');
const webMerge              = require('../../vendor/webmerge');
const Utils                 = require('../../utils');
const {
  TRASH_SCOPES,
  // UNTRASHED_SCOPE,
  DEPOSIT_PRICES,
  DEPOSIT_REFUND_DELAYS,
  TWO_OCCUPANTS_FEES,
  LEASE_DURATION,
}                           = require('../../const');
const {
  NODE_ENV,
  WEBMERGE_DOCUMENT_ID,
  WEBMERGE_DOCUMENT_KEY,
}                           = require('../../config');
const {GOOGLE_CALENDAR_IDS} = require('../../config');
const routes                = require('./routes');
const hooks                 = require('./hooks');
const collection            = require('./collection');

const _ = { capitalize, values };

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
      validate: {
        isRoomAvailable(date) {
          return models.Room.scope('availableAt')
            .findById(this.RoomId)
            .then((room) => {
              return room.checkAvailability(date);
            })
            .then((isAvailable) => {
              if ( !isAvailable ) {
                throw new Error('The room is already booked');
              }
              return isAvailable;
            });
        },
      },
    },
    expectedCheckoutDate:  {
      type:                     DataTypes.DATE,
      required: false,
    },
    price: {
      type:                     DataTypes.INTEGER,
      // required: true,
      // allowNull: false,
    },
    serviceFees: {
      type:                     DataTypes.INTEGER,
      // required: true,
      // allowNull: false,
    },
    status: {
      type:                     DataTypes.ENUM('draft', 'active'),
      defaultValue: 'draft',
      // required: true,
      // allowNull: false,
    },
    comfortLevel: {
      type:                     DataTypes.VIRTUAL,
    },
    packDiscount: {
      type:                     DataTypes.VIRTUAL(DataTypes.INTEGER),
    },
    hasTwoOccupants: {
      type:                     DataTypes.VIRTUAL(DataTypes.BOOLEAN),
      defaultValue: false,
    },
    checkinDate: {
      type:                     DataTypes.VIRTUAL(DataTypes.DATE),
      get: checkinoutDateGetter('checkin'),
    },
    checkoutDate: {
      type:                     DataTypes.VIRTUAL(DataTypes.DATE),
      get: checkinoutDateGetter('checkout'),
    },
  }, {
    paranoid: true,
    scopes: Object.assign({}, TRASH_SCOPES/*, UNTRASHED_SCOPE*/),
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

    Renting.addScope('depositOption', {
      include: [{
        required:false,
        model: models.Term,
        where: { taxonomy: 'deposit-option' },
      }],
    });

    Renting.addScope('comfortLevel', {
      attributes: { include: [[
        sequelize.fn('replace', sequelize.col('ProductId'), '-pack', ''),
        'comfortLevel',
      ]]},
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

    Renting.addScope('client', {
      include: [{
        model : models.Client,
      }],
    });

    Renting.addScope('room', {
      include: [{
        model: models.Room,
      }],
    });

    Renting.addScope('client+identity', {
      include: [{
        model: models.Client,
        include: [{
          required: false,
          model: models.Metadata,
          where: { name: 'clientIdentity' },
          limit: 1,
        }],
      }],
    });
  };

  // Prorate the price and service fees of a renting for a given month
  Renting.prorate = function(renting, date) {
    const { bookingDate, price, serviceFees } = renting;
    const checkoutDate = renting.get('checkoutDate');
    const daysInMonth = D.getDaysInMonth(date);
    const startOfMonth = D.startOfMonth(date);
    const endOfMonth = D.endOfMonth(date);
    let daysStayed = daysInMonth;

    if (
      bookingDate > endOfMonth ||
      ( checkoutDate != null && checkoutDate < startOfMonth )
    ) {
      daysStayed = 0;
    }
    else {
      if ( bookingDate >= startOfMonth ) {
        daysStayed -= D.getDate(bookingDate) - 1;
      }
      if ( checkoutDate != null && checkoutDate < endOfMonth ) {
        daysStayed -= daysInMonth - D.getDate(checkoutDate);
      }
    }

    return {
      price: Utils.roundBy100(( price / daysInMonth ) * daysStayed),
      serviceFees: Utils.roundBy100(( serviceFees / daysInMonth ) * daysStayed),
    };
  };
  Renting.prototype.prorate = function(date) {
    return Renting.prorate(this, date);
  };

  // Propagate the status of the renting to that of first-rent/deposit/pack orders
  // and their orderItems
  Renting.prototype.normalizeOrder = function(order) {
    if ( order.OrderItems != null ) {
      order.OrderItems = order.OrderItems.map((item) => {
        return Object.assign({
          status: this.status,
          deletedAt: this.deletedAt,
        }, item);
      });
    }

    return Object.assign({
      type: 'debit',
      ClientId: this.ClientId,
      // We want the order to be a draft if the renting is a draft
      status: this.status,
      deletedAt: this.deletedAt,
    }, order);
  };

  Renting.prototype.toOrderItems = function({ date = new Date(), room = this.Room }) {
    const prorated = this.prorate(date);
    const apartment = room.Apartment;
    const month = D.format(date, 'MMMM');

    return [{
      label: `Loyer ${month} - Chambre #${room.reference}`,
      unitPrice: prorated.price,
      RentingId: this.id,
      status: this.status,
      ProductId: 'rent',
    }, {
      label: `Charges ${month} - Apt #${apartment.reference}`,
      unitPrice: prorated.serviceFees,
      RentingId: this.id,
      status: this.status,
      ProductId: 'service-fees',
    }];
  };

  Renting.findOrphanOrderItems = function(rentings, order) {
    return Promise.map(rentings, (renting) => {
      return models.OrderItem
        .findAll({
          where: {
            RentingId: renting.id,
            status: 'draft',
            OrderId: null,
          },
          include: [{
            model: models.Term,
            where: {
              name: 'Next Rent Invoice',
              taxonomy: 'orderItem-category',
              termable: 'OrderItem',
            },
          }],
        })
        .map((orderItem) => {
          return orderItem.update({
            status: renting.status,
            OrderId: order.id,
          });
        });
    });
  };

  Renting.prototype.findOrCreateRentOrder = function(args) {
    const { date = new Date(), room, number } = args;

    return models.Order
      .findItemOrCreate({
        where: {
          RentingId: this.id,
          ProductId: 'rent',
        },
        include: [{
          model: models.Order,
          where: { dueDate: Math.max(new Date(), D.startOfMonth(date)) },
//          paranoid: false, // include drafts
        }],
        defaults: this.normalizeOrder({
          label: `${D.format(date, 'MMMM')} Invoice`,
          dueDate: Math.max(new Date(), D.startOfMonth(date)),
          OrderItems: this.toOrderItems({ date, room }),
          number,
        }),
      });
  };

  Renting.prototype.findOrCreatePackOrder = function(args) {
    const { comfortLevel, discount, number, room = this.Room } = args;
    const {addressCity} = room.Apartment;
    const ProductId = `${comfortLevel}-pack`;

    return Utils
      .getPackPrice(addressCity, comfortLevel)
      .then((packPrice) => {
        return models.Order
          .findItemOrCreate({
            where: {
              RentingId: this.id,
              ProductId: {
                $like: '%-pack',
              },
            },
            defaults: this.normalizeOrder({
              label: 'Housing Pack',
              dueDate: Math.max(new Date(), D.startOfMonth(this.bookingDate)),
              OrderItems: [
                {
                  label: `Housing Pack ${addressCity} ${comfortLevel}`,
                  unitPrice: packPrice,
                  RentingId: this.id,
                  status: this.status,
                  ProductId,
                },
                discount != null && discount !== 0 && {
                  label: 'Discount',
                  unitPrice: -1 * discount,
                  RentingId: this.id,
                  status: this.status,
                  ProductId,
                },
                // We should not add more items to this order. We want to keep the amount
                // as low as possible to avoid turning down customers
              ].filter(Boolean),
              number,
            }),
          });
        });
  };

  Renting.prototype.findOrCreateDepositOrder = function(args) {
    const { room = this.Room, number} = args;
    const {addressCity} = room.Apartment;
    const ProductId = `${addressCity}-deposit`;

    return models.Order
      .findItemOrCreate({
        where: {
          RentingId: this.id,
          ProductId,
        },
        defaults: this.normalizeOrder({
          type: 'deposit',
          status: 'draft',
          label: 'Deposit',
          OrderItems: [{
            label: 'Deposit',
            unitPrice: DEPOSIT_PRICES[addressCity],
            RentingId: this.id,
            status: this.status,
            ProductId,
          }],
          number,
        }),
      });
  };

  // this function finds or creates checkin and checkout Order,
  // if it's a checkout order, it also creates a refund event
  ['checkin', 'checkout'].forEach((type) => {
    Renting.prototype[`findOrCreate${_.capitalize(type)}Order`] =
      function(number) {
        const {name} = this.Room;
        const {Apartment} = this.Room;

        return Promise.all([
            Utils[`get${_.capitalize(type)}Price`](
              this.get(`${type}Date`),
              this.get('comfortLevel'),
              Apartment.addressCity),
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
                label: `Late notice ${name}`,
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

  Renting.prototype.createOrUpdateRefundEvent = function(date) {
    const {name} = this.Room;
    const {firstName, lastName} = this.Client;
    const startDate = D.addDays(date, DEPOSIT_REFUND_DELAYS[this.get('comfortLevel')]);
    const category = 'refund-deposit';

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
          }, { transaction });
        });
    });
  };

  // #findOrCreateCheckinEvent and #findOrCreateCheckoutEvent
  ['checkin', 'checkout'].forEach((type) => {
    Renting[`findOrCreate${_.capitalize(type)}Event`] = function(args) {
      const { startDate, renting, client, room, transaction, hooks } = args;
      const {firstName, lastName, phoneNumber} = client;
      const term = {
        name: type,
        taxonomy: 'event-category',
        termable: 'Event',
      };

      return Utils[`get${_.capitalize(type)}EndDate`](startDate)
        .then((endDate) => {
          return models.Event.findOrCreate({
            where: {
              EventableId: renting.id,
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
                ${room.name},
                tel: ${phoneNumber || 'N/A'}\
              `),
              eventable: 'Renting',
              EventableId: renting.id,
              Terms: [term],
            },
            transaction,
            hooks,
          });
        });
    };

    Renting.prototype[`findOrCreate${_.capitalize(type)}Event`] =
      function(startDate, { transaction, hooks }) {
        return Renting[`findOrCreate${_.capitalize(type)}Event`]({
          renting: this,
          client: this.Client,
          room: this.Room,
          startDate,
          transaction,
          hooks,
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
        location: Utils.toSingleLine(`
          ${Apartment.addressStreet},
          ${Apartment.addressZip} ${Apartment.addressCity},
          ${Apartment.addressCountry}
        `),
      },
    };
  };

  /*  handle update of an event, check if an Order
      is related to this event and create/update it
      Also update/create Refund Event if it's a 'Checkout' Event
  */
  // TODO: this can probably be improved as well
  Renting.prototype.handleEventUpdate = function(event, options) {
    const type = event.get('category');

    return Renting.scope(type === 'refund-deposit' ? 'client' :
                         [`${type}Order`, 'room+apartment'])
      .findById(this.id)
      .then((renting) => {
        if ( !renting ) {
          throw new Error('Client doesn\'t have a pack order yet');
        }
        const {Orders} = renting.Client === undefined || null ? null : renting.Client;

        return Promise.all([
            type !== 'refund-deposit' ? Utils[`getC${type.substr(1)}Price`](
              event.startDate,
              this.getComfortLevel(),
              this.Room.Apartment.addressCity) : 0,
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

  Renting.prototype.generateLease = function() {
    return Renting
      .webmergeSerialize(this)
      .then((serialized) => {
        return webMerge.mergeDocument(
          WEBMERGE_DOCUMENT_ID,
          WEBMERGE_DOCUMENT_KEY,
          serialized,
          NODE_ENV !== 'production' // webmerge's test environment switch
        );
      });
  };

  Renting.prototype.createQuoteOrders = function(args) {
    const {comfortLevel, packDiscount, room } = args;

    return Promise.mapSeries([
        { suffix: 'RentOrder', args: { date: this.bookingDate, room } },
        { suffix: 'DepositOrder', args: { room } },
        { suffix: 'PackOrder', args: { comfortLevel, packDiscount, room } },
      ], (def) => {
        return this[`findOrCreate${def.suffix}`](def.args);
      })
      .then(([[rentOrder], [depositOrder], [packOrder]]) => {
        return models.Order
          .ninjaCreateInvoices([rentOrder, depositOrder, packOrder]);
      });
  };

<<<<<<< 6c5e1f9deade52907b4011cded02afca06349381
  Renting.prototype.futureCredit = function(args) {
    const {discount, label} = args;

    return models.OrderItem.create({
      label,
      quantity: 1,
      unitPrice: discount,
      status: 'draft',
      RentingId: this.id,
      ProductId: 'discount',
      Terms: [{
        name: 'Next Rent Invoice',
        taxonomy: 'orderItem-category',
        termable: 'OrderItem',
      }],
    }, {
      include: models.Term,
    });
  };

  Renting.prototype.futureDebit = function(args) {
    const {amount, reason, label, invoiceWith} = args;

    return models.Product
      .find({
        where: {
          name: reason,
        },
        attributes: ['id'],
      })
      .then((product) => {
        return models.OrderItem.create({
          label,
          quantity: 1,
          unitPrice: amount,
          status: 'draft',
          RentingId: this.id,
          ProductId: product.id,
          Terms: [{
            name: invoiceWith,
            taxonomy: 'orderItem-category',
            termable: 'OrderItem',
          }],
        }, {
          include: models.Term,
        });
      });
  };

  Renting.prototype.welcomeEmailSerialized = function () {
    const {Apartment} = this.Room;
    const {name, addressStreet, addressZip, addressCity} = Apartment;

    return {
      emailTo: [this.Client.email],
      attributes: {
        APARTMENT: `${addressStreet}, ${_.capitalize(addressCity)}, ${addressZip}`,
        FIRSTNAME: _.capitalize(this.Client.firstName),
        BOOKINGDATE: D.format(this.bookingDate, 'DD/MM/YYYY'),
        RENT: (this.price / 100) + (this.serviceFees / 100),
        EMAIL: this.Client.email,
        DEPOSIT: DEPOSIT_PRICES[addressCity] / 100,
        ADDRESSAGENCY: AGENCY_ADDRESSES[addressCity],
        SPECIALCHECKIN: SPECIAL_CHECKIN_PRICE[addressCity] / 100,
        ROOM: {
          fr: name.split(' ').splice(-1)[0] === 'studio' ?
          'l\'appartement entier<strong>' :
          `la chambre nº<strong>${this.Room.reference.slice(-1)}`,
          en: name.split(' ').splice(-1)[0] === 'studio' ?
            'our studio<strong>' : `bedroom nº<strong>${this.Room.reference.slice(-1)}`,
        },
      },
    };
  };
=======
>>>>>>> PR review

  Renting.webmergeSerialize = function(renting) {
    const {Client, Terms, Room} = renting;
    const {Apartment} = Room;
    const {name, addressStreet, addressZip, addressCity} = Apartment;
    const bookingDate = renting.bookingDate || new Date();
    const identity = JSON.parse(Client.Metadata[0].value);
    const fullAddress = _.values(identity.address).filter(Boolean).join(', ');
    const birthDate = _.values(identity.birthDate).join('/');
    const roomNumber = name.split(' ').splice(-1)[0] === 'studio' ?
      'l\'appartement entier' : `la chambre privée nº${Room.reference.slice(-1)}`;
    const depositOption = !Terms[0] || (Terms[0] && Terms[0].name === 'cash') ?
      'd\'encaissement du montant' : 'de non encaissement du chèque';
    let packLevel;

    switch (renting.get('comfortLevel')) {
      case 'comfort':
        packLevel = 'Confort';
        break;
      case 'privilege':
        packLevel = 'Privilège';
        break;
      default:
        packLevel = 'Basique';
        break;
    }

    return Promise.resolve({
      fullName: `${Client.firstName} ${Client.lastName.toUpperCase()}`,
      fullAddress,
      birthDate,
      birthPlace: Utils.toSingleLine(`
        ${identity.birthPlace.first}
        (${_.capitalize(identity.birthCountryFr)})
      `),
      nationality: identity.nationalityFr,
      rent: renting.price / 100,
      serviceFees: renting.serviceFees / 100,
      deposit: DEPOSIT_PRICES[addressCity] / 100,
      depositOption,
      packLevel,
      roomNumber,
      roomFloorArea: Room.floorArea,
      floorArea: Apartment.floorArea,
      address: `${addressStreet}, ${_.capitalize(addressCity)}, ${addressZip}`,
      floor: Apartment.floor === 0 ? 'rez-de-chausée' : Apartment.floor,
      bookingDate: D.format(bookingDate, 'DD/MM/YYYY'),
      endDate: D.format(D.addMonths(
        D.subDays(bookingDate, 1), LEASE_DURATION), 'DD/MM/YYYY'),
      email: Client.email,
    });
  };

  Renting.getPeriod = function(renting, date = new Date()) {
    const checkoutDate = renting.get('checkoutDate');
    const {bookingDate} = renting;

    if ( checkoutDate && checkoutDate < date ) {
      return 'past';
    }
    else if ( bookingDate > date ) {
      return 'future';
    }

    return 'current';
  };

  Renting.getLatest = function(rentings) {
    return rentings.reduce((acc, curr) => {
      return curr.bookingDate > acc.bookingDate ? curr : acc;
    }, rentings[0]);
  };

  Renting.calculatePriceAndFees = function({ room, bookingDate, hasTwoOccupants }) {
    return models.Room
      .getCalculatedProps(
        room.basePrice,
        room.Apartment && room.Apartment.roomCount,
        bookingDate
      )
      .then(({periodPrice, serviceFees}) => {
        return {
          serviceFees,
          price: periodPrice + ( hasTwoOccupants ? TWO_OCCUPANTS_FEES : 0 ),
        };
      });
  };
  Renting.prototype.calculatePriceAndFees = function(room) {
    return Renting
      .calculatePriceAndFees({
        room,
        bookingDate: this.bookingDate,
        hasTwoOccupants: this.hasTwoOccupants,
      })
      .then(({price, serviceFees}) => {
        this.setDataValue('price', price);
        this.setDataValue('serviceFees', serviceFees);
        return this;
      });
  };

  Renting.collection = collection;
  Renting.routes = routes;
  Renting.hooks = hooks;

  return Renting;
};
