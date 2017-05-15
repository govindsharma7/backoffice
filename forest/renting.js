const Liana   = require('forest-express-sequelize');
const {
  BASIC_PACK,
  COMFORT_PACK,
  PRIVILEGE_PACK,
  TRASHED_DRAFT,
} = require('../src/const');

Liana.collection('Renting', {
  fields: [{
    field: 'price euro',
    type: 'Number',
    get(renting) {
      return renting.price / 100;
    },
    set(renting, value) {
      renting.price = Math.round(value * 100);
      return renting;
    },
  }, {
    field: 'service fees euro',
    type: 'Number',
    get(renting) {
      return renting.serviceFees / 100;
    },
    set(renting, value) {
      renting.serviceFees = Math.round(value * 100);
      return renting;
    },
  }],
  actions:[{
    name: 'Create Pack Order',
    fields: [{
      field: 'comfortLevel',
      type: 'Enum',
      enums: [BASIC_PACK, COMFORT_PACK, PRIVILEGE_PACK],
    }, {
      field: 'Discount',
      type: 'Number',
    }],
  }, {
    name: 'Create Rent Order',
  }],
  segments : TRASHED_DRAFT,
});
