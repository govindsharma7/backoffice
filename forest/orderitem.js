const Liana = require('forest-express-sequelize');
const {TRASH_SEGMENTS} = require('../src/const');

Liana.collection('OrderItem', {
  actions: [{
    name: 'Add Discount',
    fields: [{
      field: 'discount',
      type: 'Number',
    }],
  }],
  segments: TRASH_SEGMENTS,
});
