const Liana = require('forest-express-sequelize');
const {TRASHED_DRAFT} = require('../src/utils/segments');

Liana.collection('Credit', {
  segments: TRASHED_DRAFT,
});
