const Liana = require('forest-express-sequelize');

Liana.collection('Setting', {
  fields: [{
    field: 'value',
    type: 'String',
  }],
});
