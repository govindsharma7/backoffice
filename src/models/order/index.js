const Promise               = require('bluebird');
const { DataTypes }         = require('sequelize');
const D                     = require('date-fns');
const _                     = require('lodash');
const Op                    = require('../../operators');
const { TRASH_SCOPES }      = require('../../const');
const payline               = require('../../vendor/payline');
const Sendinblue            = require('../../vendor/sendinblue');
const Utils                 = require('../../utils');
const sequelize             = require('../sequelize');
const models                = require('../models'); //!\ Destructuring forbidden /!\
const collection            = require('./collection');
const routes                = require('./routes');
const hooks                 = require('./hooks');

const { required, CNError, methodify } = Utils;

const Order = sequelize.define('Order', {
  id: {
    primaryKey: true,
    type:                     DataTypes.UUID,
    defaultValue:             DataTypes.UUIDV4,
  },
  type: {
    type:                     DataTypes.ENUM('debit', 'credit', 'deposit'),
    defaultValue: 'debit',
    // required: true,
    // allowNull: false,
  },
  receiptNumber: {
    type:                     DataTypes.STRING,
    unique: true,
  },
  label: {
    type:                     DataTypes.STRING,
    // required: true,
    // allowNull: false,
  },
  ninjaId: {
    type:                     DataTypes.INTEGER,
  },
  dueDate: {
    type:                     DataTypes.DATEONLY,
    defaultValue: new Date(),
  },
  status: {
    type:                     DataTypes.ENUM('draft', 'active', 'cancelled'),
    defaultValue: 'active',
  },
}, {
  paranoid: true,
  scopes: Object.assign({}, TRASH_SCOPES),
});

Order.associate = (models) => {
  Order.hasMany(models.OrderItem);
  Order.belongsTo(models.Client, {
    foreignKey: { notNull: true },
  });
  Order.hasMany(models.Payment);
  Order.hasMany(models.Credit);
  Order.hasMany(models.Term, {
    foreignKey: 'TermableId',
    constraints: false,
    scope: { termable: 'Order' },
  });
  Order.hasMany(models.Metadata, {
    foreignKey: 'MetadatableId',
    constraints: false,
    scope: { metadatable: 'Order' },
  });
  Order.hasOne(models.TotalPaid, {
    foreignKey: 'OrderId',
    constraints: false,
  });

  Order.addScope('rentOrders', {
    include: [{
      model: models.OrderItem,
      where: { ProductId: 'rent' },
    }],
  });

  Order.addScope('packItems', {
    include: [{
      model: models.OrderItem,
      where: { ProductId: { [Op.like]: '%-pack' } },
      include: [{
        model: models.Renting,
        include: [{
          model: models.Room,
        }],
      }],
    }],
  });

  Order.addScope('draftRentOrders', {
    include: [{
      model: models.OrderItem,
      where: {
        ProductId: 'rent',
        status: 'draft',
      },
      include: [{
        model: models.Renting,
      }],
    }],
  });

  // TODO: this is an attempt at simplifying Sequelize job using views
  Order.addScope('totalPaid', {
    attributes: { include: [
      [sequelize.col('TotalPaid.totalPaid'), 'totalPaid'],
    ] },
    include: [{
      model: models.TotalPaid,
      required: false,
    }],
  });

  Order.addScope('totalPaidRefund', {
    attributes: [[
      sequelize.fn('sum', sequelize.literal('`Payments`.`amount`')),
      'totalPaid',
    ], [
      sequelize.fn('sum', sequelize.literal('`Payments->Refunds`.`amount`')),
      'totalRefund',
    ]],
    include: [{
      model: models.Payment,
      attributes: [],
      include: [{
        model: models.Credit,
        as: 'Refunds',
        attributes: [],
      }],
    }],
  });

  const [
    unitPrice,
    quantity,
    vatRate,
  ] = 'unitPrice,quantity,vatRate'.split(',')
    .map((col) => `\`OrderItems\`.\`${col}\``);

  Order.addScope('amount', {
    attributes: [
      'id',
      [sequelize.fn('sum', sequelize.literal(
        `${unitPrice} * ${quantity} * ( 1 + IFNULL(${vatRate}, 0) )`
      )), 'amount'],
    ],
    include:[{
      model: models.OrderItem,
      attributes: [],
    }],
    group: ['Order.id'],
  });

  Order.addScope('invoice', {
    include: [{
      model: models.Client,
      include: [{
        model: models.Metadata,
        required: false,
        where: { name: 'clientIdentity' },
      }],
    }, {
      model: models.OrderItem,
      include: [{
        model: models.Renting,
        required: false,
        include: [{
          model: models.Room,
          include: [{
            model: models.Apartment,
          }],
        }],
      }],
    }],
  });

  Order.addScope('lateRents', (date = new Date()) => ({
    subQuery: false, // we're good, all those include are singular
    where: {
      dueDate: { [Op.lt]: date },
      createdAt: { [Op.lt]: D.subDays(date, 7) },
    },
    include: [{
      model: models.OrderItem,
      where: { ProductId: 'rent' },
      required: true,
    }, {
      model: models.Client,
      where: {
        status: 'active',
        id: { [Op.not]: 'maintenance' },
      },
      required: true,
    }, {
      model: models.TotalPaid,
      where: { totalPaid: { [Op.or]: [0, null] } },
      required: true,
    }],
  }));
};

Order.prototype.getTotalPaidAndRefund = async function() {
  const options = { paranoid: this.deletedAt != null };
  const order = await Order.scope('totalPaidRefund').findById(this.id, options);

  return {
    totalPaid: order.get('totalPaid'),
    totalRefund: order.get('totalRefund'),
  };
};

Order.prototype.getAmount = async function() {
  const option = { paranoid: this.deletedAt != null };
  const order = await Order.scope('amount').findById(this.id, option);

  return order.get('amount');
};
// Return all calculated props (amount, totalPaid, balance)
Order.prototype.getCalculatedProps = async function() {
  const [{totalPaid, totalRefund}, amount] = await Promise.all([
    this.getTotalPaidAndRefund(),
    this.getAmount(),
  ]);

  return {
    amount,
    totalPaid,
    totalRefund,
    balance: totalPaid - amount - totalRefund,
  };
};

Order.prototype.destroyOrCancel = function() {
  return Order.destroyOrCancel({ order: this });
};
Order.destroyOrCancel = function({ order = required() }) {
  if ( order.status === 'cancelled' || order.deletedAt ) {
    throw new Error('This order is already destroyed or cancelled');
  }

  // Some orders can be deleted straight away
  if (
    order.type !== 'debit' ||
    ( !order.receiptNumber && !order.Payments.length )
  ) {
    return Promise.all([order.destroy()]); // resolve w/ [order] for consistency
  }

  // Others must be 'cancelled'
  return sequelize.transaction((transaction) => {
    const cancelPromise = Order.create({
      type: 'credit',
      label: `Credit Order - #${order.receiptNumber}`,
      ClientId: order.ClientId,
      OrderItems: order.OrderItems.map((orderItem) => ({
        label: orderItem.label,
        quantity: orderItem.quantity,
        unitPrice: orderItem.unitPrice * -1,
        vatRate: orderItem.vatRate,
        ProductId: orderItem.ProductId,
        RentingId: orderItem.RentingId,
      })),
    }, {
      include: [{ model: models.OrderItem }],
      transaction,
    });
    const updatePromise = order.update({ status: 'cancelled' }, { transaction });

    return Promise.all([updatePromise, cancelPromise]);
  });
};

Order.prototype.pickReceiptNumber = function(args) {
  return Order.pickReceiptNumber(Object.assign({ order: this }, args));
};
Order.pickReceiptNumber = function({ order = required(), transaction }) {
  if ( order.receiptNumber ) {
    return Promise.resolve(order);
  }

  let settingId;
  let strNumber;
  const updater = (transaction) =>
    models.Setting
      .findById(settingId, { transaction })
      .then((counter) =>
        Promise.all([
          counter.increment({ transaction }),
          order.update(
            Object.assign(
              { receiptNumber: strNumber(counter.value + 1) },
              order.status === 'draft' && { status: 'active' }
            ),
            { transaction }
          ),
        ])
      );

  switch (order.type) {
    case 'deposit':
      settingId = 'deposit-counter';
      strNumber = (num) => `deposit-${num}`;
      break;
    case 'credit':
    case 'debit':
    default:
      settingId = 'invoice-counter';
      strNumber = (num) => num.toString();
      break;
  }

  return ( transaction ? updater(transaction) : sequelize.transaction(updater) )
    .thenReturn(order);
};

Order.pay = async function(args) {
  const { order = required(), balance = required(), card = required() } = args;
  const {
    cardNumber: number,
    holderName: holder,
    cvv: cvx,
    expiryYear,
    expiryMonth,
  } = card;
  const expirationDate = _.padStart(`${expiryMonth}${expiryYear}`, 4, '0');
  const type = Utils.getCardType(number);
  const purchaseId = `${order.id}-${new Date().getTime()}`;
  let purchase;

  try {
    if ( !type ) {
      throw new CNError('Invalid Card Type', {
        code: 'payment.invalidCardType',
      });
    }

    if ( order.status === 'cancelled' ) {
      throw new CNError(`Order ${order.id} has been cancelled`, {
        code: 'payment.orderCancelled',
      });
    }

    if ( balance >= 0 ) {
      throw new CNError(`Order ${order.id} is already fully paid`, {
        code: 'payment.orderPaid',
      });
    }

    // There's always a possibility that the payment is succesfully sent to
    // Payline and that an asteroid destroys our servers before we receive
    // the success message. This metadata allows us to track such problems.
    await models.Metadata.create({
      name: 'paymentAttempt',
      value: purchaseId,
      MetadatableId: order.id,
      metadatable: 'Order',
    });

    purchase = await payline.doPurchase(
      purchaseId,
      { number, type, expirationDate, holder, cvx },
      -balance
    );

    await models.Payment.create({
      type: 'card',
      amount: -balance,
      paylineId: purchase.transactionId,
      OrderId: order.id,
    });
  }
  catch (error) {
    await models.Metadata.create({
      name: 'paymentError',
      value: JSON.stringify(error),
      MetadatableId: order.id,
      metadatable: 'Order',
    });

    throw error;
  }

  return purchase;
};
methodify(Order, 'pay');

Order.sendPaymentRequest = function(args) {
  const {
    order = required(),
    client = required(),
    amount,
    balance,
  } = args;
  const { OrderItems } = order;
  const isRent = OrderItems.some(({ ProductId }) => ProductId === 'rent' );

  if ( balance >= 0 ) {
    throw new Error('Can\'t send payment request, the balance is positive');
  }

  return Sendinblue.sendPaymentRequest({ order, amount, client, isRent });
};
methodify(Order, 'sendPaymentRequest');

// TODO: improve that shit
Order.sendRentReminders = function(now = new Date()) {
  return Order.scope('rentOrders')
    .findAll({
      where: {
        [Op.or]: [
          { dueDate: now },
          { dueDate: D.addDays(now, 3) },
          { dueDate: D.addDays(now, 5) },
        ],
      },
      include: [{
        model: models.Client,
        where: { status: 'active' },
      }],
    })
    .map((order) => Promise.all([
      order,
      order.getCalculatedProps(),
    ]))
    .filter(([, { balance }]) => balance < 0)
    .map(([order, { amount }]) =>
      Sendinblue.sendRentReminder({ order, client: order.Client, amount })
    );
};

// Order.updateLateFees = function(date = new Date()) {
//
// };

Order.collection = collection;
Order.routes = routes;
Order.hooks = hooks;

module.exports = Order;
