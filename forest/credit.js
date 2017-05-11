const Liana = require('forest-express-sequelize');
const {TRASHED_DRAFT} = require('../src/const');

Liana.collection('Credit', {
  segments: TRASHED_DRAFT,
});
