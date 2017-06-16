const Liana       = require('forest-express-sequelize');
const Utils       = require('../src/utils');
const {
  BASIC_PACK,
  COMFORT_PACK,
  PRIVILEGE_PACK,
  TRASH_SEGMENTS,
}                 = require('../src/const');

Liana.collection('Renting', {
  fields: [{
    field: 'booking date coef',
    type: 'Number',
    get(object) {
      return Utils.getPeriodPrice(1, object.bookingDate);
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
  }, {
    name: 'Restore Renting',
  }, {
    name: 'Destroy Renting',
  }],
  segments : TRASH_SEGMENTS,
});
