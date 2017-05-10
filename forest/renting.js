const Liana   = require('forest-express-sequelize');
const {TRASHED_DRAFT} = require('../src/utils/segments');


Liana.collection('Renting', {
  actions:[{
    name: 'Housing pack',
    fields: [{
        field: 'comfortLevel',
        type: 'Enum',
        enums: ['basique', 'confort', 'privilege'],
      }, {
        field: 'Discount',
        type: 'Number',
      }],
  }, {
    name: 'Create Order',
  }],
  segments : TRASHED_DRAFT,
});
