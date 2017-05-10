const Liana   = require('forest-express-sequelize');
const {TRASHED_DRAFT} = require('../src/utils/segments');


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
  }],
  segments: TRASHED_DRAFT,
});
