const Liana            = require('forest-express-sequelize');
const D                = require('date-fns');
const {Room}           = require('../src/models');
const {TRASH_SEGMENTS} = require('../src/const');
const Utils            = require('../src/utils');

const memoizer = new Utils.calculatedPropsMemoizer(Room.scope('apartment'));

Liana.collection('Room', {
  fields: [{
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
    field: 'current-client',
    type: ['String'],
    reference: 'Client.id',
  }],
  actions: [{
    name: 'Restore Room',
  }, {
    name: 'Destroy Room',
  }],
  segments: TRASH_SEGMENTS.concat([{
    name: 'Available Rooms',
    where: () => {
      return Room.scope('latestRenting')
        .findAll({
          where: {
            $or: [{
              '$latestRentingId$': null,
            }, {
              '$latestCheckoutDate$': {
                $and: {
                  $not: null,
                  $lt: D.format(Date.now()),
                },
              },
            }],
          },
        })
        .then((rooms) => {
          return { id : rooms.map((room) => {
            return room.id;
          }) };
        });
    },
  }]),
});
