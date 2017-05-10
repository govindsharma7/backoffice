const Liana = require('forest-express-sequelize');
const {TRASHED_DRAFT} = require('../src/utils/segments');

Liana.collection('Room', {
  segments: TRASHED_DRAFT,
});
