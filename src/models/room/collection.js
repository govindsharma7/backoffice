const capitalize       = require('lodash/capitalize');
const {TRASH_SEGMENTS} = require('../../const');
const Utils            = require('../../utils');

const _ = { capitalize };

module.exports = function({Room}) {
  const memoizer = new Utils.calculatedPropsMemoizer( Room.scope('apartment') );

  return {
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
    }, {
      field: 'Pictures',
      type: ['String'],
      reference: 'Picture.id',
    }],
    actions: [{
      name: 'Restore Room',
    }, {
      name: 'Destroy Room',
    }],
    segments: TRASH_SEGMENTS.concat(
      ['lyon', 'montpellier', 'paris'].map((city) => {
        return {
          name: `Available Rooms ${_.capitalize(city)}`,
          where: () => {
            return Room.scope('latestRenting')
              .findAll({
                where: {
                  '$Rentings.status$': 'active',
                  '$Apartment.addressCity$' : `${city}`,
                },
              })
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
                const now = Date.now();

                return latestRenting.bookingDate < now && checkoutDate <= now;
              })
              .reduce((acc, curr) => {
                acc.id.push(curr.id);
                return acc;
              }, { id: [] });
          },
        };
      })
    ),
  };
};
