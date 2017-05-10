const Liana = require('forest-express-sequelize');

Liana.collection('Credit', {
  segments: [{
    name: 'Trashed',
    scope: 'trashed',
  }, {
    name: 'Draft',
    scope: 'draft',
  }],
});
