const {TRASH_SEGMENTS} = require('../../const');

module.exports = function({ Order, Client }) {
  return {
    actions: [{
      name: 'Refund',
      fields: [{
          field: 'amount',
          type: 'Number',
          description: 'required',
        }, {
          field: 'reason',
          type: 'String',
        }],
    }, {
      name: 'Restore Payment',
    }, {
      name: 'Destroy Payment',
    }],
    fields: [{
      field: 'client',
      type: 'String',
      reference: 'Client.id',
      get(object) {
        return Order
          .findById(object.OrderId)
          .then((order) => {
            return Client.findById(order.ClientId);
          });
      },
    }],
    segments: TRASH_SEGMENTS,
  };
};
