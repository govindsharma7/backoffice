const Promise = require('bluebird');

module.exports = function({ Order, OrderItem, Client, Renting }) {

  Order.hook('beforeDestroy', (order) => {
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
  Order.handleAfterUpdate = async function(order, { transaction }) {
    if ( !order.changed('status') || order.status !== 'active' ) {
      return true;
    }

    const { OrderItems, ClientId } = await Order.findById(order.id, {
      include: [{ model: OrderItem }],
      transaction,
    });
    const rentingItem = OrderItems.find((item) => item.RentingId != null);

    return Promise.all([
      // This is a batch update, so individual OrderItems hooks won't fire
      OrderItem.update({ status: 'active' }, { where: {
        OrderId: order.id,
        status: 'draft',
      } }),
      // This is a batch update, so individual client hooks won't fire
      Client.update({ status: 'active' }, { where: {
        id: ClientId,
        status: 'draft',
      } }),
      // Here we explicitely ask renting hooks to fire
      rentingItem && Renting.update(
        { status: 'active' },
        {
          where: {
            id: rentingItem.RentingId,
            status: 'draft',
          },
          individualHooks: true,
        }
      ),
    ]);
  };
  Order.hook('afterUpdate', (order, opts) =>
    Order.handleAfterUpdate(order, opts)
  );
};
