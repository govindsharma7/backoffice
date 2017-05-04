const Liana   = require('forest-express-sequelize');

Liana.collection('Renting',{
  actions:[{
    name: 'Housing pack',
    fields: [{
        field: 'comfortLevel',
        type: 'Enum',
        enums: ['Basic', 'Confort', 'Privilège'],
      },{
        field: 'Price',
        type: 'Number',
      }],
  }],
});