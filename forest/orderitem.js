const Liana = require('forest-express-sequelize');
const {TRASHED_DRAFT} = require('../src/const');

Liana.collection('OrderItem', {
  fields: [{
    field: 'unit price euro',
    type: 'Number',
    get(item) {
      return item.unitPrice / 100;
    },
    set(item, value) {
      item.unitPrice = Math.round(value * 100);
      return item;
    },
  }],
  actions: [{
    name: 'Add Discount',
  }],
  segments: TRASHED_DRAFT,
});
