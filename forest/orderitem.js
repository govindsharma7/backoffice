const Liana = require('forest-express-sequelize');
const {TRASH_SEGMENTS} = require('../src/const');

Liana.collection('OrderItem', {
  fields: [{
    field: 'unitPrice',
    type: 'Number',
    set(item, value) {
      item.unitPrice = Math.round(value * 100);
      return item;
    },
  }],
  actions: [{
    name: 'Add Discount',
    fields: [{
      field: 'discount',
      type: 'Number',
    }],
  }],
  segments: TRASH_SEGMENTS,
});
