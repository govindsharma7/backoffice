const Liana = require('forest-express-sequelize');

Liana.collection('Client', {
  fields: [{
    field: 'Invoices',
    type: ['String'],
    reference: 'Invoice.id',
  }],
});
