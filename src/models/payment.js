const Promise        = require('bluebird');
const Liana          = require('forest-express-sequelize');
const payline        = require('../vendor/payline');
const Utils          = require('../utils');
const {TRASH_SCOPES} = require('../const');

module.exports = (sequelize, DataTypes) => {
  const {models} = sequelize;
  const Payment = sequelize.define('Payment', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    type: {
      type:                     DataTypes.ENUM('card', 'sepa', 'manual'),
      required: true,
      defaultValue: 'card',
      allowNull: false,
    },
    amount: {
      type:                     DataTypes.INTEGER,
      required: true,
      allowNull: false,
    },
    paylineId: {
      type:                     DataTypes.STRING,
      required: true,
      allowNull: false,
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

  Payment.rawAssociations = [
    { belongsTo: 'Order' },
    { hasMany: 'Credit', options: {
      as: 'Refunds',
    }},
  ];

  Payment.paylineRefund = (id, values) => {
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

  Payment.afterLianaInit = (app) => {
    const LEA = Liana.ensureAuthenticated;

    app.post('/forest/actions/refund', LEA, (req, res) => {
      var {values, ids} = req.body.data.attributes;

      Promise.resolve()
        .then(() => {
          if (!values.amount) {
            throw new Error('Please specify an amount');
          }
          if (ids.length > 1) {
            throw new Error('Can\'t refund multiple payments');
          }

          values.amount *= 100;

          return Payment.paylineRefund(ids[0], values);
        })
        .then(() => {
          return res.send({success: 'Refund ok'});
        })
        .catch(Utils.logAndSend(res));
    });
  };

  return Payment;
};
