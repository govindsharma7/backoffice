const _                   = require('lodash');
const {
  TRASH_SEGMENTS,
  CITIES,
}                         = require('../../const');
const Utils               = require('../../utils');

module.exports = function({ Apartment, Picture, Term, Room, Client }) {
  const galeryFields = Utils.generateGaleryFields(Apartment, Picture);
  const featuresFields = Utils.generateFeaturesFields(Apartment, Term);
  const scopedRoom = Room.scope({ method: ['availableAt', { includeClient: true }]});

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
      type: ['String'],
      // TODO: this is too complex and doesn't belong here.
      // It should move to apartment/index.js and be unit-tested
      async get(object) {
        const rooms = await scopedRoom.findAll({
          where: { ApartmentId: object.id },
        });

        return rooms
          .sort((a, b) => a.reference < b.reference ? -1 : 1)
          .map((room) => {
            const client = room.Rentings[0] && room.Rentings[0].Client;
            const identity = client && Client.getFullIdentity({
              client,
              identityRecord: client.identityRecord,
            });

            // Each housemate/room is represented as a single string since
            // Liana can't serialize complex values
            return (room.availableAt != null ? [
              room.id,
              room.availableAt.toISOString(),
            ] : [
              client.firstName,
              (identity.gender || '').toLowerCase(),
              identity.descriptionEn,
              identity.descriptionFr,
            ]).join('\n');
          });
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
