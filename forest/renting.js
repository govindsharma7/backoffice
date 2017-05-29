const Liana   = require('forest-express-sequelize');
const {
  BASIC_PACK,
  COMFORT_PACK,
  PRIVILEGE_PACK,
  TRASH_SEGMENTS,
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
      field: 'discount',
      type: 'Number',
    }],
  }, {
    name: 'Create Rent Order',
  }, {
    name: 'Add Checkin Date',
    fields: [{
      field: 'plannedDate',
      type: 'Date',
    }],
  }, {
    name: 'Add Checkout Date',
    fields :[{
      field: 'plannedDate',
      type: 'Date',
    }],
  }, {
    name: 'Create Checkout Order',
  }, {
    name: 'Room Switch Order',
    fields: [{
      field: 'discount',
      type: 'Number',
    }],
  }],
  segments : TRASH_SEGMENTS,
});
