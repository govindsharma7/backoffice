const Liana = require('forest-express-sequelize');

Liana.collection('OrderItem', {
  fields: [{
    field: '_unitPrice',
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
  segments: [{
    name: 'Trashed',
    scope: 'trashed',
  }, {
    name: 'Draft',
    scope: 'draft',
  }],
});
