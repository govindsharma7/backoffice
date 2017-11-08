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
          order.OrderItems.length > 0 && models.Order.scope('welcomeEmail')
            .findAll({ where: { ClientId: order.ClientId } }),
        ]);
      })
      .then(([{ messageId }, order, orders]) => {
        const metadata = [{ value: messageId, MetadatableId: order.id }];

        if ( !orders ) {
          // TODO: refactor this with the same block few lines below once we
          // switch to async/await
          return models.Metadata.bulkCreate(metadata.map((item) => {
            return { name: 'messageId', metadatable: 'Order', ...item };
          }));
        }

        const { Renting } = orders[0].OrderItems[0].Renting;

        /* eslint-disable promise/no-nesting */
        return orders && SendinBlue.sendWelcomeEmail({
            rentOrder: orders[0],
            depositOrder: orders[1],
            client: order.Client,
            renting: Renting,
            room: Renting.Room,
            apartment: Renting.Room.Apartment,
          })
          .then(({ messageId }) => {
            [].push.apply(metadata, orders.map((order) => {
              return { value: messageId, MetadatableId: order.id };
            }));

            return models.Metadata.bulkCreate(metadata.map((item) => {
              return { name: 'messageId', metadatable: 'Order', ...item };
            }));
          });
        /* eslint-enable promise/no-nesting */
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
