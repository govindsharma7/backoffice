const Liana   = require('forest-express-sequelize');
const payline = require('../vendor/payline');
const {TRASH_SCOPES} = require('../const');

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
  }, {
    paranoid: true,
    scopes: TRASH_SCOPES,
  });
  const {models} = sequelize;

  Payment.associate = () => {
    Payment.belongsTo(models.Order);
    Payment.hasMany(models.Credit);
  };

  Payment.doRefund = (id, values) => {
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

  Payment.beforeLianaInit = (app) => {
    const LEA = Liana.ensureAuthenticated;

    app.post('/forest/actions/refund', LEA, (req, res) => {
      var {values, ids} = req.body.data.attributes;

      if (!values.amount) {
        return res.status(400).send({error:'Please specify an amount'});
      }
      if (ids.length > 1) {
        return res.status(400).send({error:'Can\'t refund multiple payments'});
      }

      values.amount *= 100;

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
