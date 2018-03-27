module.exports = function({ OrderItem, Order }) {

  ['beforeCreate', 'beforeUpdate', 'beforeDestroy'].forEach((hookName) =>
    OrderItem.hook(hookName, async (orderItem) => {
      const order = await Order.findById(orderItem.OrderId);

      if (
        hookName === 'beforeUpdate' &&
        // RentingId and ProductId are info used internally and can be modified
        Object.keys(orderItem._changed)
          .every((name) => name === 'RentingId' || name === 'ProductId')
      ) {
        return orderItem;
      }

      if ( order && order.receiptNumber ) {
        throw new Error(
          `Cannot modify items of order ${order.id} which has a receipt number`
        );
      }

      return orderItem;
    })
  );
};
