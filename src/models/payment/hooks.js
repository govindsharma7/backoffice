const Promise     = require('bluebird');
const SendinBlue  = require('../../vendor/sendinblue');

module.exports = function(models, Payment) {
  Payment.hook('afterCreate', (payment) => {
    return models.Order
      .findOne({
        where: { id: payment.OrderId },
        include: [{ model: models.Client }],
      })
      .then((order) => {
        return Promise.all([
          SendinBlue.sendConfirmationPayment({
            order,
            client: order.Client,
            amount: payment.amount,
          }),
          order,
        ]);
      })
      .then(([{ messageId }, order]) => {
        return order.createMetadatum({
          name: 'messageId',
          value: messageId,
        });
      });
  });

  Payment.hook('beforeDelete', (payment) => {
    if ( payment.type !== 'manual' ) {
      throw new Error('Only manual payments can be deleted');
    }

    return payment;
  });

  Payment.hook('beforeUpdate', (payment) => {
    if ( payment.type !== 'manual' ) {
      throw new Error('Only manual payments can be updated');
    }

    return payment;
  });
};
