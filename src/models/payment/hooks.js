const Promise                     = require('bluebird');
const Sendinblue                  = require('../../vendor/sendinblue');
const Zapier                      = require('../../vendor/zapier');

module.exports = function({ Payment, Order, OrderItem, Client, Renting }) {
  // When a payment is created:
  // - send a payment confirmation message (and store its messageId)
  // - send a notif to zapier webhook
  // - pick a receiptNumber
  Payment.handleAfterCreate = async function(payment, { transaction }) {
    const order = await Order.findOne({
      where: { id: payment.OrderId },
      include: [Client, OrderItem],
      transaction,
    });
    const packItem =
      order.OrderItems.find(({ ProductId }) => /-pack$/.test(ProductId));
    let renting;

    if ( packItem ) {
      renting =
        await Renting.scope('room+apartment').findById(packItem.RentingId);
    }

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
        room: renting && renting.Room,
        apartment: renting && renting.Room.Apartment,
      }),
      order.pickReceiptNumber({ transaction }),
    ]);
  };
  Payment.hook('afterCreate', (payment, opts) =>
    Payment.handleAfterCreate(payment, opts)
  );

  ['beforeDestroy', 'beforeUpdate'].forEach((type) =>
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
