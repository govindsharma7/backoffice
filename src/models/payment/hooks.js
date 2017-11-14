const Promise     = require('bluebird');
const Sendinblue  = require('../../vendor/sendinblue');

module.exports = function({ Payment, Order, Client }) {
  // When a payment is created:
  // - send a payment confirmation message (and store its messageId)
  // - pick a receiptNumber
  Payment.hook('afterCreate', (payment) =>
    Order
      .findOne({
        where: { id: payment.OrderId },
        include: [{
          model: Client,
        }],
      })
      .then((order) => Promise.all([
        Sendinblue.sendPaymentConfirmation({
          order,
          client: order.Client,
          amount: payment.amount,
        }),
        Order.pickReceiptNumber(order),
      ]))
  );

  ['beforeDelete', 'beforeUpdate'].forEach((type) =>
    Payment.hook(type, (payment) => {
      if ( payment.type !== 'manual' ) {
        throw new Error(
          `Only manual payments can be ${type.replace('before', '').toLowerCase()}ed`
        );
      }

      return payment;
    })
  );
};
