module.exports = function(models, Order) {
  Order.hook('beforeCreate', (order) => {
    if ( order.status !== 'active' ) {
      order.setDataValue('deletedAt', Date.now());
    }
  });

  Order.hook('afterUpdate', Order.afterUpdate);

  Order.hook('beforeDelete', (order) => {
    const isDeleted = order.deletedAt != null;

    return order.getOrderItems({paranoid: !isDeleted})
      .map((orderItem) => {
        return orderItem.destroy({force: isDeleted});
      });
  });

  Order.hook('afterRestore', (order) => {
    return order.getOrderItems({paranoid: false})
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
