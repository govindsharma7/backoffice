const SendinBlue  = require('../../vendor/sendinblue');

module.exports = function(models, Payment) {
  Payment.hook('afterCreate', (payment) => {
    return models.Order.scope('client')
      .findById(payment.OrderId)
      .then((order) => {
        return SendinBlue.sendConfirmationPayment({
          order,
          client: order.Client,
          amount: payment.amount,
        });
    });
  });
};
