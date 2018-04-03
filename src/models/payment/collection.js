const { TRASH_SEGMENTS }  = require('../../const');

module.exports = function() {
  return {
    fields: [{
      field: 'type',
      type: 'Enum',
      // Restrict the list of types available in Forest
      enums: ['manual-card', 'manual-cash', 'manual-transfer', 'manual-cheque'],
    }, {
      field: 'client',
      type: 'String',
      reference: 'Order.ClientId',
      async get(object) {
        return (
          await object.requireScopes(['order+client'], { include: null })
        ).Order.Client;
      },
    }, {
      field: 'clientName',
      type: 'String',
      async get(object) {
        return (
          await object.requireScopes(['order+client'], { include: null })
        ).Order.Client.fullName;
      },
    }],
    actions: [{
      name: 'Refund',
      fields: [{
          field: 'amount',
          type: 'Number',
          isRequired: true,
        }, {
          field: 'reason',
          type: 'String',
        }],
    }, {
      name: 'Restore Payment',
    }, {
      name: 'Destroy Payment',
    }],
    segments: TRASH_SEGMENTS.concat({
      name: 'default',
      scope: 'order+client',
    }),
  };
};
