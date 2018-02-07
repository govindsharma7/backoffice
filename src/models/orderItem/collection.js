const {TRASH_SEGMENTS} = require('../../const');

module.exports = function() {
  return {
    actions: [{
      name: 'Add Discount',
      fields: [{
        field: 'discount',
        type: 'Number',
        isRequired: true,
      }],
    }, {
      name: 'Restore OrderItem',
    }, {
      name: 'Destroy OrderItem',
    }],
    segments: TRASH_SEGMENTS,
  };
};
