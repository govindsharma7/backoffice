module.exports = function({ OrderItem, Order }) {

  ['beforeCreate', 'beforeUpdate', 'beforeDelete'].forEach((hookName) =>
    OrderItem.hook(hookName, (orderItem) =>
      Order
        .findById(orderItem.OrderId)
        .then((order) => {
          if ( order && order.receiptNumber ) {
            throw new Error('Cannot modify this order, it has a receipt number');
          }

          return null;
        })
    )
  );
};
