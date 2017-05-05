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
    app.post('/forest/actions/refund', Liana.ensureAuthenticated, (req,res) => {
      var{values, ids} = req.body.data.attributes;
      var amount = values.amount * 100;

      Payment
        .findById(ids[0])
        .then((payment) => {
          if (payment.paylineId !== null) {
            return payline.doRefund(payment.paylineId, amount);
          }
          else {
            throw new Error('This payment can\'t be refund online');
          }
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
          res.statusCode = 200;
          res.send({success: 'Refund ok'});
          return true;
        })
        .catch((err) => {
          console.error(err);
          res.statusCode = 400;
          res.send({error: err.message || err.longMessage});
        });
    });
  };

  return Payment;
};
