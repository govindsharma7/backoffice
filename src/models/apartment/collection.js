const capitalize          = require('lodash/capitalize');
const {
  TRASH_SEGMENTS,
  CITIES,
}                         = require('../../const');
const Utils               = require('../../utils');

const _ = { capitalize };

module.exports = function({ Apartment, Picture, Term, Room, Client }) {
  const galeryFields = Utils.generateGaleryFields(Apartment, Picture);
  const featuresFields = Utils.generateFeaturesFields(Apartment, Term);

  return {
    fields: [{
      // for some reason, Forest excludes belongsTo foreign keys from schemas
      // a quick and safe hack to bring it back is to create an alias
      field: '_DistrictId',
      type: 'String',
      get(object) { return object.DistrictId; },
    }, {
      field: 'current-clients',
      type: ['String'],
      reference: 'Client.id',
    }, {
      field: 'housemates',
      type: 'String',
      async get(object) {
        const rooms = await Room.scope('currentOccupants').findAll({
          where: { ApartmentId: object.id },
        });

        return rooms.map((room) =>
          room.Rentings[0] && Client.getFullIdentity({
            client: room.Rentings[0].Client,
            clientIdentity: room.Rentings[0].Client.Metadata[0],
          })
        );
      },
    }].concat(galeryFields, featuresFields),

    actions: [{
      name: 'Restore Apartment',
    }, {
      name: 'Destroy Apartment',
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
      CITIES.map((city) => ({
        name: _.capitalize(city),
        scope: city,
      }))
    ),
  };
};
