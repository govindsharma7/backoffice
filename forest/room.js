const Liana = require('forest-express-sequelize');
const {TRASHED_DRAFT} = require('../src/const');

Liana.collection('Room', {
  segments: TRASHED_DRAFT,
});
