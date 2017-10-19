const capitalize          = require('lodash/capitalize');
const { WEBSITE_URL }     = require('../../config');
const { TRASH_SEGMENTS }  = require('../../const');
const Utils               = require('../../utils');

const _ = { capitalize };

module.exports = function({Room, Picture}) {
  const memoizer = new Utils.calculatedPropsMemoizer(
    Room.scope('availableAt', 'apartment')
  );

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
      field: 'cover picture',
      type: 'String',
      get(object) {
        return Picture.findOne({
          where: {
            PicturableId: object.id,
          },
        })
        .then((picture) => {
          return picture ? picture.url : null;
        });
      },
    }, {
      field: 'preview',
      description: 'frontend preview url',
      type: 'String',
      get(object) {
        return `${WEBSITE_URL}/en-US/room/${object.id}`;
      },
    }],
    actions: [{
      name: 'Restore Room',
    }, {
      name: 'Destroy Room',
    }, {
      name: 'Maintenance Period',
      fields: [{
        field: 'from',
        type: 'Date',
        isRequired: true,
      }, {
        field: 'to',
        type: 'Date',
      }],
    }],
    segments: TRASH_SEGMENTS.concat(
      {
        name: 'Availability',
        scope: 'availableAt',
      },
      ['lyon', 'montpellier', 'paris'].map((city) => {
        return {
          name: `Available Rooms ${_.capitalize(city)}`,
          scope: 'apartment+availableAt',
          where: () => {
            // TODO: this query is awfull. We join on all rentings that ever
            // existed when we know only the one with the latest bookingDate
            // are valuable. For now, the performances are acceptable though.
            // Here are the alternatives we considered and rejected:
            //   - Using a Renting scope, as this would exclude any Room that has
            //     never had an active renting.
            //   - Same, + searching for Rooms that never had an active Renting,
            //     as this is probably even less efficient
            //   - Using include.separate = true, as we've never been able to get
            //     it to work :-/
            // Here are the alternatives we have yet to investigate:
            //   - Add a hook to Room to create a fake Renting with a
            //     bookingDate and checkoutDate at epoch, so we can sort our
            //     problem with a Renting scope
            //   - Switch to TypeORM and see if that makes things simpler for us
            //     using subrequest probably
            return Room.scope('availableAt', 'apartment')
              .findAll({
                where: { '$Apartment.addressCity$' : `${city}` },
              })
              .filter((room) => {
                return room.checkAvailability();
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
