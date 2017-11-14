const Liana          = require('forest-express-sequelize');
const Promise        = require('bluebird');
const padStart       = require('lodash/padStart');
const Utils          = require('../../utils');
const makePublic     = require('../../middlewares/makePublic');

const _ = { padStart };

module.exports = function(app, models, Payment) {
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

        return Payment.refund(ids[0], values);
      })
      .then(() => {
        return res.send({success: 'Payment Successfully Refund'});
      })
      .catch(Utils.logAndSend(res));
  });

  app.post('/forest/actions/public/create-payment', makePublic, (req, res) => {
    const {
      cardNumber,
      holderName,
      expiryMonth,
      expiryYear,
      cvv,
      orderId,
    } = req.body;
    const cardType = Utils.getCardType(cardNumber);
    const expirationDate = _.padStart(`${expiryMonth}${expiryYear}`, 4, '0');

    return models.Order.findOne({
        where: { id: orderId },
        include: [{ model: models.OrderItem }],
      })
      .then((order) => {
        if ( !order ) {
          throw new Error(`Order "${orderId}" not found`);
        }

        return Promise.all([order, order.getCalculatedProps()]);
      })
      .then(([order, { balance }]) => order.pay({
        balance,
        card: {
          cardNumber,
          holderName,
          expirationDate,
          cvv,
          cardType,
        },
      }))
      .then(({ transactionId }) => res.send({ paymentId: transactionId }))
      .catch((error) => {
        console.error(error);
        return res.status(400).send({
          error: error.longMessage || error.shortMessage || error.message,
        });
      });
  });

  Utils.addRestoreAndDestroyRoutes(app, Payment);
};
