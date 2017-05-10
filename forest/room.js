const Liana = require('forest-express-sequelize');

Liana.collection('Room', {
  segments: [{
    name: 'Trashed',
    scope: 'trashed',
  }, {
    name: 'Draft',
    scope: 'draft',
  }],
});
