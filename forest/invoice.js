const Liana = require('forest-express-sequelize');

Liana.collection('Invoice', {
  idField: 'id',
  fields: [{
    field: 'id',
    type: 'String',
  }, {
    field: 'href',
    type: 'String',
  }],
});
