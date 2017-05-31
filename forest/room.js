const Liana            = require('forest-express-sequelize');
const {Room}           = require('../src/models');
const {TRASH_SEGMENTS} = require('../src/const');
const Utils            = require('../src/utils');

const memoizer = new Utils.calculatedPropsMemoizer(Room);

Liana.collection('Room', {
  fields: [{
    field: 'base price euro',
    type: 'Number',
    get(item) {
      return item.basePrice / 100;
    },
    set(item, value) {
      item.basePrice = Math.round(value * 100);
      return item;
    },
  }, {
    field: 'current price euro',
    type: 'Number',
    get(object) {
      return memoizer.getCalculatedProps(object)
        .then((result) => {
          return result.periodPrice / 100;
        })
        .tapCatch(console.error);
    },
  }, {
    field: 'service fees euro',
    type: 'Number',
    get(object) {
      return memoizer.getCalculatedProps(object)
        .then((result) => {
          return result.serviceFees / 100;
        })
        .tapCatch(console.error);
    },
  }],
  segments: TRASH_SEGMENTS,
});
