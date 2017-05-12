const Liana = require('forest-express-sequelize');
const {TRASH_SEGMENTS} = require('../src/const');

Liana.collection('Room', {
  fields: [{
    field: 'base price euro',
    type: 'Number',
    get(item) {
      return item.basePrice / 100;
    },
    set(item, value) {
      item.basePrice = Math.round(value * 100);
      return item;
    },
  }],
  segments: TRASH_SEGMENTS,
});
