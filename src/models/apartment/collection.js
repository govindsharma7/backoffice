const capitalize          = require('lodash/capitalize');
const {
  TRASH_SEGMENTS,
  CITIES,
}                         = require('../../const');
const Utils               = require('../../utils');

const _ = { capitalize };

module.exports = function({ Apartment, Picture, Term }) {
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
