const { DataTypes }         = require('sequelize');
const Promise               = require('bluebird');
const D                     = require('date-fns');
const _                     = require('lodash');
const Op                    = require('../../operators');
const {
  TRASH_SCOPES,
  // DEPOSIT_REFUND_DELAYS,
  TWO_OCCUPANTS_FEES,
}                           = require('../../const');
const Utils                 = require('../../utils');
const { NODE_ENV }          = require('../../config');
const sequelize             = require('../sequelize');
const models                = require('../models'); //!\ Destructuring forbidden /!\
const routes                = require('./routes');
const hooks                 = require('./hooks');
const collection            = require('./collection');

const { methodify, required } = Utils;

function checkinoutDateGetter(type) {
  // TODO: use hasScope to return null when the checkin/outDate scope isn't
  // present or false when we know there is no event.
  return function() {
    /* eslint-disable no-invalid-this */
    const date = this.dataValues[`${type}Date`];
    /* eslint-enable no-invalid-this */

    return date == null || typeof date == 'object' ?
      date : Utils.parseDBDate(date);
  };
}

const Renting = sequelize.define('Renting', {
  id: {
    primaryKey: true,
    type:                     DataTypes.UUID,
    defaultValue:             DataTypes.UUIDV4,
  },
  bookingDate: { // bookingDate is now validated in beforeValidate hook
    type:                     DataTypes.DATE,
    required: false,
  },
  expectedCheckoutDate:  {
    type:                     DataTypes.DATE,
    required: false,
  },
  price: {
    type:                     DataTypes.INTEGER,
    defaultValue: 0,
    required: true,
    allowNull: false,
  },
  serviceFees: {
    type:                     DataTypes.INTEGER,
    defaultValue: 0,
    required: true,
    allowNull: false,
  },
  status: {
    type:                     DataTypes.ENUM('draft', 'active'),
    defaultValue: 'draft',
    required: true,
    allowNull: false,
  },
  packLevel: {
    type:                     DataTypes.VIRTUAL(
      DataTypes.ENUM('basic', 'comfort', 'privilege')
    ),
  },
  discount: {
    type:                     DataTypes.VIRTUAL(DataTypes.INTEGER),
  },
  hasTwoOccupants: {
    type:                     DataTypes.VIRTUAL(DataTypes.BOOLEAN),
    defaultValue: false,
  },
  dontSendBookingSummary: {
    type:                     DataTypes.VIRTUAL(DataTypes.BOOLEAN),
    defaultValue: false,
  },
  // WATCH OUT: only meaningful when checkinDate scope is used
  checkinDate: {
    type:                     DataTypes.VIRTUAL(DataTypes.DATE),
    get: checkinoutDateGetter('checkin'),
  },
  // WATCH OUT: only meaningful when checkoutDate scope is used
  checkoutDate: {
    type:                     DataTypes.VIRTUAL(DataTypes.DATE),
    get: checkinoutDateGetter('checkout'),
  },
  // WATCH OUT: only meaningful when checkoutDate scope is used
  period: {
    type:                     DataTypes.VIRTUAL(
      DataTypes.ENUM('current', 'past', 'future')
    ),
    get() { return this.getPeriod(); },
  },
}, {
  paranoid: true,
  scopes: TRASH_SCOPES,
});

Renting.associate = (models) => {
  const { col, literal } = sequelize;

  Renting.belongsTo(models.Client, {
    foreignKey: { notNull: true },
  });
  Renting.belongsTo(models.Room, {
    foreignKey: { notNull: true },
  });
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
  Renting.hasMany(models.Metadata, {
    foreignKey: 'MetadatableId',
    constraints: false,
    scope: { metadatable: 'Renting' },
  });

  // checkinDate, checkoutDate scopes
  const [, checkoutDateScopeArgs] = ['checkin', 'checkout'].map((type) => {
    const args = {
      subQuery: false, // we're good, there's only one event of this type
      attributes: { include: [[col('Events.startDate'), `${type}Date`]] },
      include: [{
        model: models.Event,
        required: false,
        on: {
          EventableId: { [Op.col]: 'Renting.id' },
          type,
        },
      }],
    };

    Renting.addScope(`${type}Date`, args);

    return args;
  });

  Renting.addScope('checkoutDate+meta', Object.assign({}, checkoutDateScopeArgs, {
    include: checkoutDateScopeArgs.include.concat(models.Metadata),
  }));

  Renting.addScope('activeForMonth', (date = Utils.now()) =>
    Object.assign({}, checkoutDateScopeArgs, {
      where: {
        status: 'active',
        bookingDate: { [Op.lte]: D.endOfMonth(date) },
        '$Events.startDate$': {
          [Op.or]: [{ [Op.eq]: null }, { [Op.gte]: D.startOfMonth(date) }],
        },
      },
    })
  );

  [
    'latestRenting',
    'currentRenting',
    'latestRentingByClient',
    'currentRentingByClient',
  ].forEach((scopeName) => {
    const view = models[scopeName.replace(/^./, ($0) => $0.toUpperCase())];
    const isCurrent = /^current/.test(scopeName);
    const foreignKey = /ByClient$/.test(scopeName) ? 'ClientId' : 'RoomId';

    Renting.hasOne(view, {
      foreignKey,
      constraints: false,
    });

    Renting.addScope(scopeName, (includedFrom = 'Renting', date = Utils.now()) => ({
      // The checkoutDate is only useful/usable when this scope isn't included
      // in another scope/query
      attributes: includedFrom === 'Renting' ? { include: [
        [literal('`Renting->Events`.`checkoutDate`'), 'checkoutDate'],
      ]} : undefined,
      where: Object.assign(
        { status: 'active' },
        isCurrent && {
          [`$${includedFrom}->Events.startDate$`]: { [Op.or]: [
            null,
            { [Op.gt]: date },
          ] },
        }
      ),
      include: [{
        model: view,
        required: true,
        on: {
          [foreignKey]: { [Op.col]: `${includedFrom}.${foreignKey}` },
          bookingDate: { [Op.col]: `${includedFrom}.bookingDate` },
        },
      }, {
        model: models.Event,
        required: false,
        attributes: ['type', 'startDate'],
        where: { type: 'checkout'},
      }],
    }));
  });

  Renting.addScope('depositOption', {
    include: [{
      required:false,
      model: models.Term,
      where: { taxonomy: 'deposit-option' },
    }],
  });

  Renting.addScope('packLevel', {
    attributes: { include: [[
      sequelize.fn('replace', sequelize.col('ProductId'), '-pack', ''),
      'packLevel',
    ]]},
    include: [{
      model: models.OrderItem,
      required: false,
      where: { ProductId: { [Op.like]: '%-pack' } },
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

  Renting.addScope('client+meta', {
    include: [{
      model: models.Client.scope('clientMeta'),
    }],
  });
};

// Prorate the price and service fees of a renting for a given month
Renting.prorate = function({ renting = required(), date = required() }) {
  return Utils.prorate({
    bookingDate: renting.bookingDate,
    price: renting.price,
    serviceFees: renting.serviceFees,
    checkoutDate: renting.get('checkoutDate'),
    date,
  });
};
methodify(Renting, 'prorate');

// Propagate the status of the renting to that of first-rent/deposit/pack orders
Renting.normalizeOrder = function({ renting, order }) {
  return Object.assign({
    ClientId: renting.ClientId,
    // We want the order to be a draft if the renting is a draft
    status: renting.status,
    deletedAt: renting.deletedAt,
  }, order);
};
methodify(Renting, 'normalizeOrder');

Renting.toOrderItems = function(args) {
  const {
    renting = required(),
    room = required(),
    order = required(),
    date = required(),
  } = args;
  const prorated = renting.prorate({ date });
  const apartment = room.Apartment;
  const month = D.format(date, 'MMMM');

  return [{
    label: `Loyer ${month} - Chambre #${room.reference}`,
    unitPrice: prorated.price,
    ProductId: 'rent',
  }, {
    label: `Charges ${month} - Apt #${apartment.reference}`,
    unitPrice: prorated.serviceFees,
    ProductId: 'service-fees',

  }].map((item) => Object.assign(item, {
    status: renting.status,
    deletedAt: renting.deletedAt,
    OrderId: order.id,
    RentingId: renting.id,
  }));
};
methodify(Renting, 'toOrderItems');

// TODO: this can be optimized to use just two queries
// This should be unit-tested before being optimized
Renting.attachOrphanOrderItems = async function(rentings, order) {
  const items = await models.OrderItem.findAll({
    where: {
      RentingId: { [Op.in]: rentings.map(({ id }) => id) },
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
  });

  return models.OrderItem.update({
    status: 'active',
    OrderId: order.id,
  }, {
    where: { id: { [Op.in]: items.map(({ id }) => id) } },
  });
};

Renting.findOrCreateRentOrder = async function(args) {
  const {
    renting = required(),
    room = required(),
    now = Utils.now(),
    transaction,
  } = args;
  const dueDate = Math.max(now, D.startOfMonth(renting.bookingDate));
  const [order, isCreated] = await models.Order.findOrCreate({
    where: {
      status: { [Op.not]: 'cancelled' },
      dueDate,
    },
    include: [{
      model: models.OrderItem,
      where: {
        RentingId: renting.id,
        ProductId: 'rent',
      },
    }],
    defaults: renting.normalizeOrder({ order: {
      label: `${D.format(dueDate, 'MMMM')} Rent`,
      dueDate,
    } }),
    transaction,
  });

  if ( isCreated ) {
    const orderItems =
      renting.toOrderItems({ order, date: renting.bookingDate, room });

    await models.OrderItem.bulkCreate(orderItems, { transaction });
  }

  return order;
};
methodify(Renting, 'findOrCreateRentOrder');

Renting.findOrCreatePackOrder = async function(args) {
  const {
    renting = required(),
    packLevel = required(),
    apartment = required(),
    discount,
    transaction,
  } = args;
  const [order, isCreated] = await models.Order.findOrCreate({
    where: { status: { [Op.not]: 'cancelled' } },
    include: [{
      model: models.OrderItem,
      where: {
        RentingId: renting.id,
        ProductId: { [Op.like]: '%-pack' },
      },
    }],
    defaults: renting.normalizeOrder({ order: {
      label: 'Housing Pack',
      dueDate: Math.max(Utils.now(), D.startOfMonth(renting.bookingDate)),
    } }),
    transaction,
  });

  if ( isCreated ) {
    const { addressCity } = apartment;
    const packItem = Utils.buildPackItem({ order, renting, addressCity, packLevel });
    const orderItems = ([
      packItem,
      discount != null && discount !== 0 && {
        label: 'Discount',
        unitPrice: -discount,
      // {
      //   label: 'Discount Offre Flash',
      //   unitPrice: -discount || -20000,
        RentingId: renting.id,
        status: renting.status,
        ProductId: packItem.ProductId,
        OrderId: order.id,
      },
    ]).filter(Boolean);

    await models.OrderItem.bulkCreate(orderItems, { transaction });
  }

  return order;
};
methodify(Renting, 'findOrCreatePackOrder');

Renting.findOrCreateDepositOrder = async function(args) {
  const {
    renting = required(),
    apartment = required(),
    transaction,
  } = args;
  const { addressCity } = apartment;
  const ProductId = `${addressCity}-deposit`;

  const [order, isCreated] = await models.Order.findOrCreate({
    where: {
      type: 'deposit',
      status: { [Op.not]: 'cancelled' },
    },
    include: [{
      model: models.OrderItem,
      where: {
        RentingId: renting.id,
        ProductId,
      },
    }],
    defaults: renting.normalizeOrder({ order: {
      type: 'deposit',
      label: 'Deposit',
    } }),
    transaction,
  });

  if ( isCreated ) {
    const orderItems = [{
      label: 'Deposit',
      unitPrice: Utils.getDepositPrice({ addressCity }),
      RentingId: renting.id,
      status: renting.status,
      OrderId: order.id,
      ProductId,
    }];

    await models.OrderItem.bulkCreate(orderItems, { transaction });
  }

  return order;
};
methodify(Renting, 'findOrCreateDepositOrder');

// this function finds or creates checkin and checkout Order,
// if it's a checkout order, it also creates a refund event
['checkin', 'checkout'].forEach((type) => {
  Renting.prototype[`findOrCreate${_.capitalize(type)}Order`] =
    function(number) {
      const { name, Apartment } = this.Room;

      return Promise.all([
          Utils[`get${_.capitalize(type)}Price`](
            this.get(`${type}Date`),
            this.get('packLevel'),
            Apartment.addressCity
          ),
          Utils.getLateNoticeFees(type, this.get(`${type}Date`), Utils.now()),
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
            .findOrCreate({
              where: { [Op.and]: [{ status: { [Op.not]: 'cancelled' } }] },
              include: [{
                model: models.OrderItem,
                where: {
                  RentingId: this.id,
                  ProductId,
                },
              }],
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

// TODO: fix this thing
// Renting.prototype.createOrUpdateRefundEvent = function(date) {
//   const {name} = this.Room;
//   const {firstName, lastName} = this.Client;
//   const startDate = D.addDays(date, DEPOSIT_REFUND_DELAYS[this.get('packLevel')]);
//   const category = 'refund-deposit';
//
//   return sequelize.transaction((transaction) =>
//     models.Event.scope('event-category')
//       .findOne({
//         where: {
//           EventableId: this.id,
//           category,
//         },
//         transaction,
//       })
//       .then((event) => {
//         if ( event ) {
//           return event.update({ startDate, endDate: startDate }, transaction);
//         }
//
//         return models.Event.create({
//           startDate,
//           endDate: startDate,
//           summary: `Refund deposit ${firstName} ${lastName}`,
//           description: `${name}`,
//           eventable: 'Renting',
//           EventableId: this.id,
//           Terms: [{
//             name: 'refund-deposit',
//             taxonomy: 'event-category',
//             termable: 'Event',
//           }],
//         }, { transaction });
//       })
//   );
// };

// #findOrCreateCheckinEvent and #findOrCreateCheckoutEvent
['checkin', 'checkout'].forEach((type) => {
  const capType = _.capitalize(type);

  Renting[`findOrCreate${capType}Event`] = async function(args) {
    const {
      startDate = required(),
      renting = required(),
      client = required(),
      room = required(),
      apartment = required(),
     } = args;
    const endDate = await Utils[`get${capType}EndDate`](startDate);

    return models.Event.findOrCreate({
      where: {
        EventableId: renting.id,
        type,
      },
      defaults: {
        startDate,
        endDate,
        type,
        summary: `${type} ${client.fullName}`,
        description: [
          client.fullName,
          room.name,
          `tel: ${client.phoneNumber || 'N/A'}`,
        ].join('\n'),
        location: [
          apartment.addressStreet,
          `${apartment.addressZip} ${apartment.addressCity}`,
          apartment.addressCountry,
        ].join(', '),
        eventable: 'Renting',
        EventableId: renting.id,
      },
    });
  };
  methodify(Renting, `findOrCreate${capType}Event`);
});

Renting.prototype.createRoomSwitchOrder = function({ discount }) {
  const packLevel = this.get('packLevel');

  return models.Client.scope('roomSwitchCount')
    .findById(this.ClientId)
    .then((client) =>
      Utils.getRoomSwitchPrice( client.get('roomSwitchCount'), packLevel )
    )
    .then((price) => {
      const items = [
        price !== 0 && {
          label: `Room switch ${packLevel}`,
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
          label: `Room switch ${packLevel})`,
          unitPrice: 0,
          ProductId: 'room-switch',
        }],
      }, { include: [models.OrderItem] });
    });
};

Renting.prototype.updatePackLevel = function(args) {
  return Renting.updatePackLevel(Object.assign({ renting: this }, args));
};
Renting.updatePackLevel = function(args) {
  const {
    renting = required(),
    addressCity = required(),
    packLevel = required(),
  } = args;
  const updatedItem = Utils.buildPackItem({ renting, addressCity, packLevel });

  return models.OrderItem.update(updatedItem, { where: {
    RentingId: renting.id,
    ProductId: { [Op.like]: '%-pack' },
    status: 'draft',
  } });
};

Renting.prototype.changeDepositOption = function(option) {
  return models.Term.build({
      taxonomy: 'deposit-option',
      termable: 'Renting',
      TermableId: this.id,
    }, {isNewRecord: false})
    .createOrUpdate(option === 'cash deposit' ? 'cash' : 'do-not-cash');
};

Renting.createQuoteOrders = function(args) {
  const {
    renting = required(),
    packLevel,
    discount,
    room = required(),
    apartment = required(),
    transaction,
  } = args;
  const toCall = [
    { suffix: 'RentOrder', args: { room } },
    { suffix: 'DepositOrder', args: { apartment } },
    { suffix: 'PackOrder', args: { packLevel, discount, apartment } },
  ];

  return Promise.map(
    toCall,
    ({ suffix, args }) =>
      renting[`findOrCreate${suffix}`](Object.assign(args, { transaction })),
    { concurrency: /^(test|dev)/.test(NODE_ENV) ? 1 : 3 }
  );
};
methodify(Renting, 'createQuoteOrders');

Renting.prototype.futureCredit = function(args) {
  const { discount, label } = args;

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

Renting.prototype.futureDebit = async function(args) {
  const {amount, reason, label, invoiceWith} = args;

  const product = await models.Product.find({
    where: { name: reason },
    attributes: ['id'],
  });

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
};

Renting.getPeriod = function({ renting, now = Utils.now() }) {
  const { checkoutDate, bookingDate } = renting;

  if ( checkoutDate && checkoutDate < now ) {
    return 'past';
  }
  else if ( bookingDate > now ) {
    return 'future';
  }

  return 'current';
};
methodify(Renting, 'getPeriod');

Renting.getLatest = function(rentings) {
  return rentings.reduce(
    (acc, curr) => curr.bookingDate > acc.bookingDate ? curr : acc,
    rentings[0]
  );
};

Renting.initializePriceAndFees = async function(args) {
  const { renting = required(), room = required(), apartment } = args;
  const date = renting.bookingDate;
  const { price, serviceFees } =
    await models.Room.getPriceAndFees({ room, apartment, date });
  const totalPrice = price + ( renting.hasTwoOccupants ? TWO_OCCUPANTS_FEES : 0 );

  renting.price = totalPrice;
  renting.serviceFees = serviceFees;

  return renting;
};
methodify(Renting, 'initializePriceAndFees');

// Update all draft rentings as well as first rent order
Renting.updateDraftRentings = async function(now = Utils.now()) {
  const rentings = await Renting.findAll({
    where: {
      status: 'draft',
      bookingDate: {
        [Op.gt]: D.subMonths(now, 1),
        // Don't update future booking dates to 'now'!
        [Op.lt]: D.startOfDay(now),
      },
    },
    include: [{
      model: models.Room,
    }, {
      model: models.OrderItem,
      where: { [Op.or]: [{ ProductId: 'rent' }, { ProductId: 'service-fees' }] },
    }],
  });
  const periodCoef = await Utils.getPeriodCoef(now);

  return Promise.map(rentings, (renting) => {
    const rentingPrice = Utils.getPeriodPrice(
      renting.Room.basePrice,
      periodCoef,
      renting.serviceFees
    );
    const { price, serviceFees } = Utils.prorate({
      bookingDate: now,
      price: rentingPrice,
      serviceFees: renting.serviceFees,
      date: now,
    });

    return Promise.all([
      renting.update({
        bookingDate: now,
        price: rentingPrice,
      }, { validate: false }), // bookingDate validation is useless at this point
      renting.OrderItems
        .find(({ ProductId }) => ProductId === 'rent')
        .update({ unitPrice: price }),
      renting.OrderItems
        .find(({ ProductId }) => ProductId === 'service-fees')
        .update({ unitPrice: serviceFees }),
      models.Order.update({ dueDate: now }, {
        where: { id: renting.OrderItems[0].OrderId },
      }),
    ]);
  }, { concurrency: 3 });
};

Renting.collection = collection;
Renting.routes = routes;
Renting.hooks = hooks;

module.exports = Renting;
