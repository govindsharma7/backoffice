const { DataTypes }     = require('sequelize');
const { TRASH_SCOPES }  = require('../../const');
const payline           = require('../../vendor/payline');
const sequelize         = require('../sequelize');
const models            = require('../models'); //!\ Destructuring forbidden /!\
const collection        = require('./collection');
const routes            = require('./routes');
const hooks             = require('./hooks');

const paymentTypes = DataTypes.ENUM.apply(DataTypes,
  'card,sepa,manual,manual-card,manual-cash,manual-transfer,manual-cheque'.split(',')
);

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

Payment.collection = collection;
Payment.routes = routes;
Payment.hooks = hooks;

module.exports = Payment;
