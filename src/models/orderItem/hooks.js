module.exports = function(models, OrderItem) {

  ['beforeCreate', 'beforeUpdate'].forEach((hookName) => {
    OrderItem.hook(hookName, (orderItem) => {
      return models.Order.findById(orderItem.OrderId)
        .then((order) => {
          if ( order.receiptNumber ) {
            throw new Error('Cannot modify this order, it has a receipt number');
          }
          return null;
        });
    });
  });

  // Run Order's afterUpdate hook when an orderItem is updated
  ['afterCreate', 'afterUpdate', 'afterDelete'].forEach((hookName) => {
    OrderItem.hook(hookName, (orderItem, { transaction }) => {
      if ( orderItem.OrderId ) {
        return orderItem
          .getOrder({ transaction })
          .then(models.Order.afterUpdate);
      }
      return null;
    });
  });
};
