const Liana            = require('forest-express-sequelize');
const {Room}           = require('../src/models');
const {TRASH_SEGMENTS} = require('../src/const');
const Utils            = require('../src/utils');

const memoizer = new Utils.calculatedPropsMemoizer(Room);

Liana.collection('Room', {
  fields: [{
    field: 'basePrice',
    type: 'Number',
    set(item, value) {
      item.basePrice = Math.round(value * 100);
      return item;
    },
  }, {
    field: 'current price',
    type: 'Number',
    get(object) {
      return memoizer.getCalculatedProps(object)
        .then((result) => {
          return result.periodPrice;
        })
        .tapCatch(console.error);
    },
  }, {
    field: 'service fees',
    type: 'Number',
    get(object) {
      return memoizer.getCalculatedProps(object)
        .then((result) => {
          return result.serviceFees;
        })
        .tapCatch(console.error);
    },
  }, {
    field: 'currentClient',
    type: ['String'],
    reference: 'Client.id',
  }],
  segments: TRASH_SEGMENTS,
});
