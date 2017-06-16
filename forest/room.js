const Liana            = require('forest-express-sequelize');
const {Room}           = require('../src/models');
const {TRASH_SEGMENTS} = require('../src/const');
const Utils            = require('../src/utils');

const memoizer = new Utils.calculatedPropsMemoizer(Room.scope('Room.Apartment'));

Liana.collection('Room', {
  fields: [{
    field: 'current price',
    type: 'Number',
    get(object) {
      return memoizer.getCalculatedProps(object)
        .then((result) => {
          return Utils.euroRound(result.periodPrice);
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
  actions: [{
    name: 'Restore Room',
  }, {
    name: 'Destroy Room',
  }],
  segments: TRASH_SEGMENTS,
});
