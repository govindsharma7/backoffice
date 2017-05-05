const Liana   = require('forest-express-sequelize');

Liana.collection('Renting', {
  actions:[{
    name: 'Housing pack',
    fields: [{
        field: 'comfortLevel',
        type: 'Enum',
        enums: ['basique', 'confort', 'privilege'],
      }, {
        field: 'price',
        type: 'Number',
      }],
  }],
});
