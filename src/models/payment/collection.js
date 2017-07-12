const {TRASH_SEGMENTS} = require('../../const');

module.exports = function() {
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
    segments: TRASH_SEGMENTS,
  };
};
