const Promise = require('bluebird');

module.exports = function({ Order, OrderItem, Client, Renting }) {

  Order.hook('beforeDelete', (order) => {
    // Order that already have a receipt number cannot be deleted.
    // They should be cancelled instead.
    if ( order.receiptNumber ) {
      throw new Error('Order already has a receipt number and can\'t be deleted');
    }

    const isDeleted = order.deletedAt != null;

    return order
      .getOrderItems({ paranoid: !isDeleted })
      .map((orderItem) => orderItem.destroy({ force: isDeleted }));
  });

  Order.hook('afterRestore', (order) =>
    order
      .getOrderItems()
      .filter((orderItem) => orderItem.deletedAt != null)
      .map((orderItem) =>
        orderItem
          .set('status', 'active')
          .restore()
      )
  );

  // When an order is updated to active:
  // - Make sure the items are active
  // - Make sure the client is active
  // - Make sure the renting is active
  Order.handleAfterUpdate = function(order) {
    if ( !order.changed('status') || order.status !== 'active' ) {
      return true;
    }

    return Order
      .findById(order.id, { include: [{ model: OrderItem }] })
      .then((order) => {
        const rentingItem =
          order.OrderItems.find((item) => item.RentingId != null);

        return Promise.all([
          OrderItem.update({ status: 'active' }, { where: {
            OrderId: order.id,
            status: 'draft',
          } }),
          Client.update({ status: 'active' }, { where: {
            id: order.ClientId,
            status: 'draft',
          } }),
          rentingItem && Renting.update(
            { status: 'active' },
            {
              where: {
                id: rentingItem.RentingId,
                status: 'draft',
              },
              individualHooks: true, // without this, renting hook won't fire
            }
          ),
        ]);
      });
  };
  Order.hook('afterUpdate', (order, opts) =>
    Order.handleAfterUpdate(order, opts)
  );
};
