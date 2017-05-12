const Liana = require('forest-express-sequelize');
const {TRASH_SEGMENTS} = require('../src/const');

Liana.collection('Credit', {
  segments: TRASH_SEGMENTS,
});
