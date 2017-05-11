const Liana   = require('forest-express-sequelize');
const payline = require('../vendor/payline');
const {SCOPE} = require('../utils/scope');

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
      defaultValue: 'card',
    },
    amount: {
      type:                     DataTypes.INTEGER,
      required: true,
    },
    paylineId: {
      type:                     DataTypes.STRING,
      required: true,
    },
    status: {
      type:                     DataTypes.ENUM('draft', 'active'),
      required: true,
      defaultValue: 'active',
    },
  }, SCOPE);
  const {models} = sequelize;

  Payment.associate = () => {
    Payment.belongsTo(models.Order);
    Payment.hasMany(models.Credit);
  };

  Payment.doRefund = (id, values) => {
    const {Credit} = sequelize.models;
    const amount = values.amount * 100;

    return Payment
      .findById(id)
      .then((payment) => {
        if (payment.paylineId == null) {
          throw new Error('This payment can\'t be refund online');
        }
        return payline.doRefund(payment.paylineId, amount);
      })
      .then((result) => {
        return Credit
          .create({
            amount,
            reason: values.reason,
            paylineId: result.transactionId,
            PaymentId: id,
          });
      });
  };

  Payment.beforeLianaInit = (app) => {
    app.post('/forest/actions/refund', Liana.ensureAuthenticated, (req, res) => {
      var {values, ids} = req.body.data.attributes;

      if (!values.amount) {
        return res.status(400).send({error:'Please specify an amount'});
      }
      if (ids.length > 1) {
        return res.status(400).send({error:'Can\'t refund multiple payments'});
      }

      return Payment.doRefund(ids[0], values)
        .then(() => {
          return res.send({success: 'Refund ok'});
        })
        .catch((err) => {
          console.error(err);
          return res.status(400).send({error: err.message || err.longMessage});
        });
    });
  };

  return Payment;
};
