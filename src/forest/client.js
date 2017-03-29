const Liana = require('forest-express-sequelize');

Liana.collection('Client', {
  fields: [{
    field: 'Invoice',
    type: ['String'],
    reference: 'invoices.id',
  }],
});
