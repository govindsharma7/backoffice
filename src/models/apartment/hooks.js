module.exports = function(models, Apartment) {
  Apartment.hook('beforeUpdate', (apartment) => {
    // if no address field has been updated…
    if (
      Object.keys(apartment._changed).every((name) => {
        return !/^address/.test(name);
      })
    ) {
      return apartment;
    }
    // We need to reload the existing apartment to make sure we have all address fields
    return Apartment
      .findById(apartment.id)
      .then((previousApartment) => {
        return apartment.calculateLatLng(Object.assign(
          {},
          previousApartment.dataValues,
          apartment.dataValues
        ));
      });
  });

  Apartment.hook('beforeDelete', (apartment) => {
    return models.Client.scope('currentApartment')
      .findAll({
        where: {
          '$Rentings->Room.ApartmentId$': apartment.id,
          '$Rentings.bookingDate$': { $lte:  new Date() },
        },
      })
      .then((clients) => {
        if ( clients.length > 0) {
          throw new Error('Cannot delete Apartment: it\'s not empty.');
        }
        return true;
      });
  });
};
