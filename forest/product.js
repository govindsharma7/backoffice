const Liana = require('forest-express-sequelize');

Liana.collection('Product', {
  segments: [{
    name: 'Trashed',
    scope: 'trashed',
  }, {
    name: 'Draft',
    scope: 'draft',
  }],
});
