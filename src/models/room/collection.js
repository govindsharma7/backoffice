const _                   = require('lodash');
const Op                  = require('../../operators');
const {
  TRASH_SEGMENTS,
  CITIES,
}                         = require('../../const');
const { WEBSITE_URL }     = require('../../config');
const Utils               = require('../../utils');

module.exports = function({ Room, Picture, Term }) {
  const galeryFields = Utils.generateGaleryFields(Room, Picture);
  const featuresFields = Utils.generateFeaturesFields(Room, Term);

  return {
    fields: [{
      field: 'current-client',
      type: ['String'],
      reference: 'Client.id',
    }, {
      field: 'availableAt',
      type: 'Date',
    }, {
      // For some reason I need to alias virtual fields which return promises
      // TODO: find out why, fix the bug (watch out, update website too) and
      // remove the underscore of this field
      field: '_currentPrice',
      type: 'Number',
      async get(object) {
        return (await object.requireScopes(['availableAt'])).currentPrice;
      },
    }, {
      // For some reason I need to alias virtual fields which return promises
      // TODO: find out why, fix the bug (watch out, update website too) and
      // remove the underscore of this field
      field: '_serviceFees',
      type: 'Number',
      async get(object) {
        return (await object.requireScopes(['availableAt'])).serviceFees;
      },
    }, {
      // There's no need to add Apartment to the scope, since Forest
      // loads belongsTo relations automatically.
      field: 'depositPrice',
      type: 'Number',
      get(object) {
        return object.Apartment && Utils.getDepositPrice(object.Apartment);
      },
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
        name: 'default',
        scope: 'availableAt',
      },
      CITIES.map((city) => ({
        name: `Available Rooms ${_.capitalize(city)}`,
        // There's no need to add Apartment to the scope, since Forest
        // loads belongsTo relations automatically.
        scope: { method: ['availableAt', { availability: 'sellable' }] },
        where: { '$Apartment.addressCity$': city },
      })),
      ['3,6,7,8', '1,2,4', '5,9'].map((zone) => ({
        name: `Available Rooms Lyon${zone}`,
        // There's no need to add Apartment to the scope, since Forest
        // loads belongsTo relations automatically.
        scope: { method: ['availableAt', { availability: 'sellable' }] },
        where: { '$Apartment.addressZip$': {
            [Op.or]: zone.split(',').map((arrdt) => `6900${arrdt}`),
        } },
      }))
    ),
  };
};
