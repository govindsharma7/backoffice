module.exports = function(models) {
  return {
    get ROOM_APARTMENT() {
      return [{
        model: models.Room,
        attributes: ['reference'],
        include: [{
          model: models.Apartment,
          attributes: ['reference', 'addressCity'],
        }],
      }];
    },
  };
};
