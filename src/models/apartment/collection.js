const {TRASH_SEGMENTS} = require('../../const');

module.exports = function({Picture}) {
  return {
    fields: [{
      field: 'current-clients',
      type: ['String'],
      reference: 'Client.id',
    }, {
      field: 'cover picture',
      type: 'String',
      get(object) {
        return Picture.findOne({
          where: { PicturableId: object.id },
        })
        .then((picture) => {
          return picture ? picture.url : null;
        });
      },
    }, {
      field: 'floorPlan',
      type: 'String',
      get(object) {
        return Picture.findOne({
          where: {
            PicturableId: object.id,
            alt: 'floorPlan',
          },
        })
        .then((picture) => {
          return picture ? picture.url : null;
        });
      },
    }],
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
