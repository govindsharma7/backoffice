const Liana = require('forest-express-sequelize');

Liana.collection('Apartment', {
  segments: [{
    name: 'Trashed',
    scope: 'trashed',
  }, {
    name: 'Draft',
    scope: 'draft',
  }],
});
