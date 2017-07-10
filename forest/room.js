const Liana            = require('forest-express-sequelize');
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
        .findAll()
        .filter((room) => {
          if (room.Rentings.length === 0) {
            return true;
          }

          // Find renting with latest bookingDate
          const latestRenting = room.Rentings.reduce((acc, curr) => {
            return curr.bookingDate > acc.bookingDate ? curr : acc;
          }, room.Rentings[0]);
          const checkoutDate =
            latestRenting.Events[0] && latestRenting.Events[0].startDate;

          return (
            latestRenting.bookingDate < Date.now() && checkoutDate <= Date.now()
          );
        })
        .reduce((acc, curr) => {
          acc.id.push(curr.id);
          return acc;
        }, { id: [] });
    },
  }]),
});
