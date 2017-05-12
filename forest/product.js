const Liana = require('forest-express-sequelize');
const {TRASH_SEGMENTS} = require('../src/const');

Liana.collection('Product', {
  segments: TRASH_SEGMENTS,
});
