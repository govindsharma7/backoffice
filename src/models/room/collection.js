const capitalize          = require('lodash/capitalize');
const {
  TRASH_SEGMENTS,
  ENUMS,
}                         = require('../../const');
const { WEBSITE_URL }     = require('../../config');
const Utils               = require('../../utils');

const _ = { capitalize };

module.exports = function({ Room, Picture }) {
  const getCalculatedProps =
    Utils.methodMemoizer(Room.scope('apartment+availableAt'), 'getCalculatedProps');
  const galeryFields =
    Utils.generateGaleryFields(Room, Picture, Object.keys(ENUMS.roomPicsAlts));

  return {
    fields: galeryFields.concat([{
      field: 'current price',
      type: 'Number',
      get(object) {
        return getCalculatedProps(object)
          .then((result) => result.periodPrice)
          .tapCatch(console.error);
      },
    }, {
      field: 'service fees',
      type: 'Number',
      get(object) {
        return getCalculatedProps(object)
          .then((result) => result.serviceFees)
          .tapCatch(console.error);
      },
    }, {
      field: 'availableAt',
      type: 'Date',
      get(object) {
        return object.availableAt;
      },
    }, {
      field: 'current-client',
      type: ['String'],
      reference: 'Client.id',
    }, {
      field: 'preview',
      description: 'frontend preview url',
      type: 'String',
      get(object) {
        return `${WEBSITE_URL}/en-US/room/${object.id}`;
      },
    }, {
      field: 'Room Number',
      type: 'Number',
      set(object, value) {
        object.roomNumber = value;
        return object;
      },
    }]),
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
      ['lyon', 'montpellier', 'paris'].map((city) => ({
        name: `Available Rooms ${_.capitalize(city)}`,
        scope: 'apartment+availableAt',
        where: () =>
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
          Room.scope('apartment+availableAt')
            .findAll({
              where: { '$Apartment.addressCity$' : `${city}` },
            })
            .filter((room) => room.checkAvailability())
            .reduce((acc, curr) => {
              acc.id.push(curr.id);
              return acc;
            }, { id: [] }),
      }))
    ),
  };
};
