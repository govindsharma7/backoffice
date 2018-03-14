const Promise                     = require('bluebird');

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
    const rentingItem =
      order.OrderItems.find(({ RentingId }) => RentingId != null);
    let renting;

    if ( rentingItem ) {
      renting = await Renting.scope('room+apartment')
        .findById(rentingItem.RentingId, { transaction });
    }

    return Promise.all([
      order.Client.sendPaymentConfirmation({
        order,
        payment,
        transaction,
      }),
      payment.zapCreated({
        client: order.Client,
        order,
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
      if ( !/^manual/.test(payment.type) ) {
        return Promise.reject(new Error(
          `Only manual payments can be ${type.replace('before', '').toLowerCase()}d`
        ));
      }

      return payment;
    })
  );
};
