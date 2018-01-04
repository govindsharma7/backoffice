const { TRASH_SEGMENTS }  = require('../../const');
const Utils               = require('../../utils');

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
    }],
    segments: TRASH_SEGMENTS.concat([{
      name: 'Lyon',
      scope: 'lyon',
    }, {
      name: 'Montpellier',
      scope: 'montpellier',
    }, {
      name: 'Paris',
      scope: 'paris',
    }]),
  };
};
