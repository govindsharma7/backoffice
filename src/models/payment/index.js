const payline        = require('../../vendor/payline');
const {TRASH_SCOPES} = require('../../const');
const collection     = require('./collection');
const routes         = require('./routes');
const hooks          = require('./hooks');

module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define('Payment', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    type: {
      type:                     DataTypes.ENUM('card', 'sepa', 'manual'),
      required: true,
      defaultValue: 'manual',
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
  const {models} = sequelize;

  Payment.associate = () => {
    Payment.belongsTo(models.Order);
    Payment.hasMany(models.Credit, {
      as: 'Refunds',
    });
  };

  Payment.refund = (id, values) => {
    const {Credit} = models;

    return Payment
      .findById(id)
      .then((payment) => {
        if (payment.paylineId == null) {
          throw new Error('This payment can\'t be refund online');
        }

        return payline.doRefund(payment.paylineId, values.amount);
      })
      .then((result) => {
        return Credit
          .create({
            amount: values.amount,
            reason: values.reason,
            paylineId: result.transactionId,
            PaymentId: id,
          });
      });
  };

  Payment.collection = collection;
  Payment.routes = routes;
  Payment.hooks = hooks;

  return Payment;
};
