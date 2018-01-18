const Promise                     = require('bluebird');
const Sendinblue                  = require('../../vendor/sendinblue');
const Zapier                      = require('../../vendor/zapier');

module.exports = function({ Payment, Order, Client }) {
  // When a payment is created:
  // - send a payment confirmation message (and store its messageId)
  // - pick a receiptNumber
  Payment.handleAfterCreate = async function(payment, { transaction }) {
    const order = await Order.findOne({
      where: { id: payment.OrderId },
      include: [{ model: Client }],
      transaction,
    });

    return Promise.all([
      Sendinblue.sendPaymentConfirmation({
        client: order.Client,
        order,
        payment,
        transaction,
      }),
      Zapier.postPayment({
        client: order.Client,
        order,
        payment,
      }),
      order.pickReceiptNumber({ transaction }),
    ]);
  };
  Payment.hook('afterCreate', (payment, opts) =>
    Payment.handleAfterCreate(payment, opts)
  );

  ['beforeDelete', 'beforeUpdate'].forEach((type) =>
    Payment.hook(type, (payment) => {
      if ( payment.type !== 'manual' ) {
        return Promise.reject(new Error(
          `Only manual payments can be ${type.replace('before', '').toLowerCase()}d`
        ));
      }

      return payment;
    })
  );
};
