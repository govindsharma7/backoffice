module.exports = function(models, Apartment) {
  Apartment.hook('beforeCreate', (apartment) => {
    if ( apartment.latLng != null ) {
      return apartment;
    }

    return apartment.calculateLatLng();
  });

  Apartment.hook('beforeUpdate', (apartment) => {
    // if no address field has been updated…
    if (
      Object.keys(apartment.changed).every((name) => {
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
};
