const { DataTypes }     = require('sequelize');
const D                 = require('date-fns');
const { required }      = require('../../utils');
const { TRASH_SCOPES }  = require('../../const');
const Zapier            = require('../../vendor/zapier');
const payline           = require('../../vendor/payline');
const sequelize         = require('../sequelize');
const models            = require('../models'); //!\ Destructuring forbidden /!\
const collection        = require('./collection');
const routes            = require('./routes');
const hooks             = require('./hooks');

const paymentTypes = DataTypes.ENUM.apply(DataTypes,
  'card,sepa,manual,manual-card,manual-cash,manual-transfer,manual-cheque'.split(',')
);
const postToZapier = Zapier.poster('ssjjcr');

const Payment = sequelize.define('Payment', {
  id: {
    primaryKey: true,
    type:                     DataTypes.UUID,
    defaultValue:             DataTypes.UUIDV4,
  },
  type: {
    type:                     paymentTypes,
    required: true,
    defaultValue: 'manual-card',
    allowNull: false,
  },
  amount: {
    type:                     DataTypes.INTEGER,
    required: true,
    allowNull: false,
  },
  paylineId: {
    type:                     DataTypes.STRING,
  },
  status: {
    type:                     DataTypes.ENUM('draft', 'active'),
    required: true,
    defaultValue: 'active',
    allowNull: false,
  },
}, {
  paranoid: true,
  scopes: TRASH_SCOPES,
});

Payment.associate = ({ Order, Credit }) => {
  Payment.belongsTo(Order);
  Payment.hasMany(Credit, {
    as: 'Refunds',
  });
};

Payment.refund = (id, values) => Payment
  .findById(id)
  .then((payment) => {
    if (payment.paylineId == null) {
      throw new Error('This payment can\'t be refund online');
    }

    return payline.doRefund(payment.paylineId, values.amount);
  })
  .then((result) => models.Credit.create({
    amount: values.amount,
    reason: values.reason,
    paylineId: result.transactionId,
    PaymentId: id,
  }));

Payment.prototype.zapCreated = function(args) {
  return Payment.zapCreated(Object.assign({ payment: this }, args));
};
Payment.zapCreated = function(args) {
  const {
    client = required(),
    payment = required(),
    order = required(),
    room = {},
    apartment = {},
  } = args;

  return postToZapier({
    messageType: 'payment',
    client: client.fullName,
    order: order.label,
    amount: payment.amount / 100,
    date: D.format(payment.createdAt, 'DD/MM/YYYY'),
    time: D.format(payment.createdAt, 'HH:mm'),
    room: room.name,
    city: apartment.addressCity,
  });
};

Payment.collection = collection;
Payment.routes = routes;
Payment.hooks = hooks;

module.exports = Payment;
