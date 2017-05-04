const Liana = require('forest-express-sequelize');

Liana.collection('OrderItem', {
  fields: [{
    field: '_unitPrice',
    type: 'Number',
    get(item) {
      return item.unitPrice / 100;
    },
    set(item, value) {
      return item.unitPrice = Math.round(value * 100);
    },
  }],
});
