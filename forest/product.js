const Liana = require('forest-express-sequelize');
const {TRASHED_DRAFT} = require('../src/const');

Liana.collection('Product', {
  segments: TRASHED_DRAFT,
});
