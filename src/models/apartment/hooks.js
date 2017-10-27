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

    // Reload the existing apartment to make sure we have all address fields
    return Apartment
      .findById(apartment.id)
      .then((prevApartment) => {
        const dataValues =
          Object.assign(prevApartment.dataValues, apartment.dataValues);

        return (
          dataValues.addressStreet &&
          dataValues.addressZip &&
          dataValues.addressCountry
        ) ? apartment.calculateLatLng(dataValues) : apartment;
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
