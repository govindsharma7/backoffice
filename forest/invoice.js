const Liana = require('forest-express-sequelize');

Liana.collection('Invoice', {
  idField: 'id',
  fields: [{
    field: 'id',
    type: 'String',
  }, {
    field: 'amount',
    type: 'Number',
  }],
});
