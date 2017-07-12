const {TRASH_SEGMENTS} = require('../../const');

module.exports = function() {
  return {
    fields: [{
      field: 'current-clients',
      type: ['String'],
      reference: 'Client.id',
    }],
    actions: [{
      name: 'Restore Apartment',
    }, {
      name: 'Destroy Apartment',
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
