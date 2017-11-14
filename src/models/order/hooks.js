module.exports = function({ Order }) {

  Order.hook('beforeDelete', (order) => {
    // Order that already have a receipt number cannot be deleted.
    // They should be cancelled instead.
    if ( order.receiptNumber ) {
      throw new Error('Order already has a receipt number and can\'t be deleted');
    }

    const isDeleted = order.deletedAt != null;

    return order.getOrderItems({paranoid: !isDeleted})
      .map((orderItem) => {
        return orderItem.destroy({force: isDeleted});
      });
  });

  Order.hook('afterRestore', (order) => {
    return order.getOrderItems()
        .filter((orderItem) => {
          return orderItem.deletedAt != null;
        })
        .map((orderItem) => {
          return orderItem
            .set('status', 'active')
            .restore();
        });
  });
};
