module.exports = function(models, OrderItem) {
//  OrderItem.hook('beforeCreate', (orderItem) => {
//    if ( orderItem.status !== 'active' ) {
//      orderItem.setDataValue('deletedAt', Date.now());
//    }
//  });

  // Run Order's afterUpdate hook when an orderItem is updated
  ['afterCreate', 'afterUpdate', 'afterDelete'].forEach((hookName) => {
    OrderItem.hook(hookName, (orderItem, { transaction }) => {
      return orderItem
        .getOrder({ transaction })
        .then(models.Order.afterUpdate);
    });
  });
};
