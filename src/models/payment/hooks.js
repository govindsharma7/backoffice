const Promise     = require('bluebird');
const SendinBlue  = require('../../vendor/sendinblue');

module.exports = function(models, Payment) {
  Payment.hook('afterCreate', (payment) => {
    return models.Order
      .findOne({
        where: { id: payment.OrderId },
        include: [{
          model: models.Client,
        }, {
          model: models.OrderItem,
          required: false,
          where: { ProductId: { $like: '%-pack' } },
        }],
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
      .tap(([{ messageId }, order]) => {
        return order.createMetadatum({
          name: 'messageId',
          value: messageId,
        });
      })
      .then(([, order]) => {
        if ( order.OrderItems.length > 0 ) {
          return models.Order.findAll({
            where: { ClientId: order.ClientId },
            attributes: ['id'],
            include: [{
              model: models.OrderItem,
              attributes: ['id', 'ProductId'],
              where: { $or: [
                { ProductId: 'rent' },
                { ProductId: { $like: '%-deposit' } }]},
              include: [{
                model: models.Renting,
                attributes: ['id', 'bookingDate', 'serviceFees', 'price'],
                include: [{
                  model: models.Room,
                  attributes: ['id', 'reference'],
                  include: [{
                    model: models.Apartment,
                    attributes: ['name', 'addressStreet', 'addressZip', 'addressCity'],
                  }],
                }],
              }],
            }, {
              model: models.Client,
              attributes: [
                'firstName',
                'lastName',
                'preferredLanguage',
                'email',
                'secondaryEmail',
              ],
            }],
          });
        }
        return null;
      })
      .then((orders) => {
        if ( orders ) {
          return SendinBlue.sendWelcomeEmail({
            rentOrder: orders[0],
            depositOrder: orders[1],
          })
          .then(({ messageId }) => {
            return orders.map((order) => {
              return order.createMetadatum({
                name: 'messageId',
                value: messageId,
              });
            });
          });
        }
        return null;
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
