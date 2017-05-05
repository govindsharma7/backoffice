const Liana   = require('forest-express-sequelize');

const payline = require('../vendor/payline');




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
  });

  Payment.associate = () => {
    const {models} = sequelize;

    Payment.belongsTo(models.Order);
    Payment.hasMany(models.Credit);
  };

  Payment.beforeLianaInit = (models, app) => {
    app.post('/forest/actions/refund', Liana.ensureAuthenticated, (req, res) => {
      var {values, ids} = req.body.data.attributes;
      var amount = values.amount * 100;

      if (!values.amount) {
        return res.status(400).send({error:'Please specify an amount'});
      }
      if (ids.length > 1) {
        return res.status(400).send({error:'Can\'t refund multiple payments'});
      }
      return Payment
        .findById(ids[0])
        .then((payment) => {
          if (payment.paylineId == null) {
            throw new Error('This payment can\'t be refund online');
          }

          return payline.doRefund(payment.paylineId, amount);
        })
        .then((result) => {
          return models.Credit
            .create({
              amount,
              reason: values.reason,
              paylineId: result.transactionId,
              PaymentId: ids[0],
            });
        })
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
