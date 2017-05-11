const Liana = require('forest-express-sequelize');
const {TRASHED_DRAFT} = require('../src/const');

Liana.collection('Apartment', {
  segments: TRASHED_DRAFT,
});
