module.exports = function({ OrderItem, Order }) {

  ['beforeCreate', 'beforeUpdate', 'beforeDestroy'].forEach((hookName) =>
    OrderItem.hook(hookName, async (orderItem) => {
      const order = await Order.findById(orderItem.OrderId);

      if ( order && order.receiptNumber ) {
        throw new Error(
          `Cannot modify items of order ${order.id} which has a receipt number`
        );
      }

      return null;
    })
  );

  OrderItem.hook('beforeFind', (options) => {
    console.log(new Error().stack)
  });
};
