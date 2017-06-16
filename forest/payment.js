const Liana   = require('forest-express-sequelize');
const {TRASH_SEGMENTS} = require('../src/const');

Liana.collection('Payment', {
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
});
