const Liana = require('forest-express-sequelize');
const {TRASH_SEGMENTS} = require('../src/const');

Liana.collection('OrderItem', {
  actions: [{
    name: 'Add Discount',
    fields: [{
      field: 'discount',
      type: 'Number',
    }],
  }, {
    name: 'Restore OrderItem',
  }, {
    name: 'Destroy OrderItem',
  }],
  segments: TRASH_SEGMENTS,
});
