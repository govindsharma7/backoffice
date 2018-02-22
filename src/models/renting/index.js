const { DataTypes }         = require('sequelize');
const Promise               = require('bluebird');
const D                     = require('date-fns');
const capitalize            = require('lodash/capitalize');
const values                = require('lodash/values');
const {
  TRASH_SCOPES,
  DEPOSIT_PRICES,
  DEPOSIT_REFUND_DELAYS,
  TWO_OCCUPANTS_FEES,
}                           = require('../../const');
const webmerge              = require('../../vendor/webmerge');
const Utils                 = require('../../utils');
const { NODE_ENV }          = require('../../config');
const sequelize             = require('../sequelize');
const models                = require('../models'); //!\ Destructuring forbidden /!\
const routes                = require('./routes');
const hooks                 = require('./hooks');
const collection            = require('./collection');

const _ = { capitalize, values };
const { methodify, required } = Utils;

function checkinoutDateGetter(type) {
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
  Renting.hasMany(models.Metadata, {
    foreignKey: 'MetadatableId',
    constraints: false,
    scope: { metadatable: 'Renting' },
  });
  Renting.hasOne(models.LatestRenting, {
    foreignKey: 'RoomId',
    constraints: false,
  });
  Renting.hasOne(models.CurrentRenting, {
    foreignKey: 'RoomId',
    constraints: false,
  });

  // checkinDate, checkoutDate scopes
  const [, checkoutDateScopeArgs] = ['checkin', 'checkout'].map((type) => {
    const args = {
      attributes: { include: [[col('Events.startDate'), `${type}Date`]] },
      include: [{
        model: models.Event,
        required: false,
        on: {
          EventableId: { $col: 'Renting.id' },
          type,
        },
      }],
    };

    Renting.addScope(`${type}Date`, args);

    return args;
  });

  Renting.addScope('activeForMonth', (date = new Date()) => ({
    attributes: checkoutDateScopeArgs.attributes,
    where: {
      status: 'active',
      bookingDate: { $lte: D.endOfMonth(date) },
      '$Events.startDate$': { $or: [{ $eq: null }, { $gte: D.startOfMonth(date) }] },
    },
    include: checkoutDateScopeArgs.include,
  }));

  ['latestRenting', 'currentRenting'].forEach((scopeName) => {
    const modelName = scopeName.replace(/^./, ($0) => $0.toUpperCase());

    Renting.addScope(scopeName, (includedFrom = 'Renting') => ({
      // The checkoutDate is only useful/usable when this scope isn't included
      // in another scope/query
      attributes: includedFrom === 'Renting' ? { include: [
        [literal('`Renting->Events`.`checkoutDate`'), 'checkoutDate'],
      ]} : undefined,
      where: Object.assign(
        { status: 'active' },
        scopeName === 'currentRenting' && {
          bookingDate: { $lte: new Date() },
          [`$${includedFrom}->Events.startDate$`]: { $or: [
            null,
            { $gt: new Date() },
          ] },
        }
      ),
      include: [{
        model: models[modelName],
        required: true,
        on: {
          RoomId: { $col: `${includedFrom}.RoomId` },
          bookingDate: { $col: `${includedFrom}.bookingDate` },
        },
      }, {
        model: models.Event,
        required: false,
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

  Renting.addScope('client+identity', {
    include: [{
      model: models.Client.scope('identity'),
    }],
  });

  Renting.addScope('client+paymentDelay', {
    include: [{
      model: models.Client.scope('paymentDelay'),
    }],
  });
};

// Prorate the price and service fees of a renting for a given month
Renting.prototype.prorate = function(date) {
  return Utils.prorate({
    bookingDate: this.bookingDate,
    price: this.price,
    serviceFees: this.serviceFees,
    checkoutDate: this.get('checkoutDate'),
    date,
  });
};

// Propagate the status of the renting to that of first-rent/deposit/pack orders
Renting.prototype.normalizeOrder = function(order) {
  return Object.assign({
    ClientId: this.ClientId,
    // We want the order to be a draft if the renting is a draft
    status: this.status,
    deletedAt: this.deletedAt,
  }, order);
};

Renting.prototype.toOrderItems = function(args) {
  return Renting.toOrderItems(Object.assign({ renting: this }, args));
};
Renting.toOrderItems = function(args) {
  const {
    renting = required(),
    room = required(),
    order = required(),
    date = new Date(),
  } = args;
  const prorated = renting.prorate(date);
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

// TODO: this can be optimized to use just two queries
// This should be unti-tested before being optimized
Renting.attachOrphanOrderItems = function(rentings, order) {
  return Promise.map(rentings, (renting) =>
    models.OrderItem
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
      })
  );
};

Renting.prototype.findOrCreateRentOrder = function (args) {
  return Renting.findOrCreateRentOrder(Object.assign({ renting: this }, args));
};
Renting.findOrCreateRentOrder = async function(args) {
  const {
    renting = required(),
    room = required(),
    now = new Date(),
    transaction,
  } = args;
  const dueDate = Math.max(now, D.startOfMonth(renting.bookingDate));
  const [order, isCreated] = await models.Order.findOrCreate({
    where: {
      status: { $not: 'cancelled' },
      dueDate,
    },
    include: [{
      model: models.OrderItem,
      where: {
        RentingId: renting.id,
        ProductId: 'rent',
      },
    }],
    defaults: renting.normalizeOrder({
      label: `${D.format(dueDate, 'MMMM')} Invoice`,
      dueDate,
    }),
    transaction,
  });

  if ( isCreated ) {
    const orderItems =
      renting.toOrderItems({ order, date: renting.bookingDate, room });

    await models.OrderItem.bulkCreate(orderItems, { transaction });
  }

  return order;
};

Renting.prototype.findOrCreatePackOrder = function (args) {
  return Renting.findOrCreatePackOrder(Object.assign({ renting: this }, args));
};
Renting.findOrCreatePackOrder = async function(args) {
  const {
    renting = required(),
    packLevel = required(),
    apartment = required(),
    discount,
    transaction,
  } = args;
  const [order, isCreated] = await models.Order.findOrCreate({
    where: { status: { $not: 'cancelled' } },
    include: [{
      model: models.OrderItem,
      where: {
        RentingId: renting.id,
        ProductId: { $like: '%-pack' },
      },
    }],
    defaults: renting.normalizeOrder({
      label: 'Housing Pack',
      dueDate: Math.max(new Date(), D.startOfMonth(renting.bookingDate)),
    }),
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

Renting.prototype.findOrCreateDepositOrder = function (args) {
  return Renting.findOrCreateDepositOrder(Object.assign({ renting: this }, args));
};
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
      status: { $not: 'cancelled' },
    },
    include: [{
      model: models.OrderItem,
      where: {
        RentingId: renting.id,
        ProductId,
      },
    }],
    defaults: renting.normalizeOrder({
      type: 'deposit',
      label: 'Deposit',
    }),
    transaction,
  });

  if ( isCreated ) {
    const orderItems = [{
      label: 'Deposit',
      unitPrice: DEPOSIT_PRICES[addressCity],
      RentingId: renting.id,
      status: renting.status,
      OrderId: order.id,
      ProductId,
    }];

    await models.OrderItem.bulkCreate(orderItems, { transaction });
  }

  return order;
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
            this.get('packLevel'),
            Apartment.addressCity
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
              label: `Late notice ${name}`,
              unitPrice: lateNoticeFees,
              RentingId: this.id,
              ProductId: 'late-notice',
            },
          ].filter(Boolean);

          return models.Order
            .findOrCreate({
              where: { $and: [{ status: { $not: 'cancelled' } }] },
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

Renting.prototype.createOrUpdateRefundEvent = function(date) {
  const {name} = this.Room;
  const {firstName, lastName} = this.Client;
  const startDate = D.addDays(date, DEPOSIT_REFUND_DELAYS[this.get('packLevel')]);
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
  const capType = _.capitalize(type);

  Renting[`findOrCreate${capType}Event`] = async function(args) {
    const {
      startDate = required(),
      renting = required(),
      client = required(),
      room = required(),
      apartment = required(),
      hooks,
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
      hooks,
    });
  };

  Renting.prototype[`findOrCreate${capType}Event`] = function(args) {
    return Renting[`findOrCreate${capType}Event`](
      Object.assign({ renting: this }, args)
    );
  };
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
    ProductId: { $like: '%-pack' },
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

Renting.prototype.generateLease = function(args) {
  return webmerge
    .serializeLease(Object.assign({ renting: this }, args))
    .then((serialized) => webmerge.mergeLease(serialized));
};

Renting.prototype.createQuoteOrders = function(args) {
  return Renting.createQuoteOrders(Object.assign({ renting: this }, args));
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
  const concurrency = /^(test|dev)/.test(NODE_ENV) ? 1 : 3;

  return Promise.map(
    toCall,
    (def) =>
      renting[`findOrCreate${def.suffix}`](Object.assign(def.args, { transaction })),
    { concurrency }
  );
};

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

Renting.getPeriod = function({ renting, now = new Date() }) {
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
Renting.updateDraftRentings = async function(now = new Date()) {
  const rentings = await Renting.findAll({
    where: {
      status: 'draft',
      bookingDate: {
        $gt: D.subMonths(now, 1),
        // Don't update future booking dates to 'now'!
        $lt: D.startOfDay(now),
      },
    },
    include: [{
      model: models.Room,
    }, {
      model: models.OrderItem,
      where: { $or: [{ ProductId: 'rent' }, { ProductId: 'service-fees' }] },
    }],
  });
  const periodCoef = await Utils.getPeriodCoef(now);

  return Promise.map(rentings, (renting) => {
    const { price, serviceFees } = Utils.prorate({
      bookingDate: now,
      price: renting.Room.basePrice,
      serviceFees: renting.serviceFees,
      date: now,
    });

    return Promise.all([
      renting.update({
        bookingDate: now,
        price: Utils.getPeriodPrice(
          renting.Room.basePrice,
          periodCoef,
          renting.serviceFees
        ),
      }, { validate: false }), // bookingDate validation is useless at this point
      renting.OrderItems
        .find(({ ProductId }) => ProductId === 'rent')
        .update({ unitPrice: price }),
      renting.OrderItems
        .find(({ ProductId }) => ProductId === 'service-fees')
        .update({ unitPrice: serviceFees }),
    ]);
  });
};

Renting.collection = collection;
Renting.routes = routes;
Renting.hooks = hooks;

module.exports = Renting;
