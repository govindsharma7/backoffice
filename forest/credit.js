const Liana = require('forest-express-sequelize');
const {TRASH_SEGMENTS} = require('../src/const');

Liana.collection('Credit', {
  fields: [{
    field: 'amount euro',
    type: 'Number',
    get(item) {
      return item.amount / 100;
    },
    set(item, value) {
      item.amount = Math.round(value * 100);
      return item;
    },
  }],
  segments: TRASH_SEGMENTS,
});
