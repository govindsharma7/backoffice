const capitalize          = require('lodash/capitalize');
const {
  TRASH_SEGMENTS,
  CITIES,
}                         = require('../../const');
const { WEBSITE_URL }     = require('../../config');
const Utils               = require('../../utils');

const _ = { capitalize };

module.exports = function({ Room, Picture, Term }) {
  const getCalculatedProps = Utils.methodMemoizer({
    model: Room.scope('availableAt'),
    method: 'getCalculatedProps',
  });
  const galeryFields = Utils.generateGaleryFields(Room, Picture);
  const featuresFields = Utils.generateFeaturesFields(Room, Term);

  return {
    fields: [{
      field: 'current price',
      type: 'Number',
      async get(object) {
        try {
          const { periodPrice } = await getCalculatedProps(object);

          return periodPrice;
        }
        catch (e) {
          console.error(e);
          return e;
        }
      },
    }, {
      field: 'service fees',
      type: 'Number',
      async get(object) {
        try {
          const { serviceFees } = await getCalculatedProps(object);

          return serviceFees;
        }
        catch (e) {
          console.error(e);
          return e;
        }
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
    }].concat(galeryFields, featuresFields),

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
    }, {
      name: 'Import Drive Pics',
      fields: [{
        field: 'urls',
        type: 'String',
        isRequired: true,
        widget: 'text area',
      }],
    }],

    segments: TRASH_SEGMENTS.concat(
      {
        name: 'Availability',
        scope: 'availableAt',
      },
      CITIES.map((city) => ({
        name: `Available Rooms ${_.capitalize(city)}`,
        scope: 'availableAt',
        where: {
          '$Rentings->Events.startDate$': { $lte: new Date() },
          '$Apartment.addressCity$': city,
        },
      }))
    ),
  };
};
