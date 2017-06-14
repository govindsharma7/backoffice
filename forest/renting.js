const Liana   = require('forest-express-sequelize');
const {
  BASIC_PACK,
  COMFORT_PACK,
  PRIVILEGE_PACK,
  TRASH_SEGMENTS,
} = require('../src/const');

Liana.collection('Renting', {
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
