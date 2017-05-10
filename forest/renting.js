const Liana   = require('forest-express-sequelize');

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
  segments: [{
    name: 'Trashed',
    scope: 'trashed',
  }, {
    name: 'Draft',
    scope: 'draft',
  }],
});
