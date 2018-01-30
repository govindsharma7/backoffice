module.exports = function({ Apartment, Client }) {
  Apartment.handleBeforeUpdate = async function(apartment) {
    // if no address field has been updated…
    if ( Object.keys(apartment._changed).every((name) => !/^address/.test(name)) ) {
      return apartment;
    }

    // Reload the existing apartment to make sure we have all address fields
    const { dataValues } = await Apartment.findById(apartment.id);
    const allDataValues = Object.assign(dataValues, apartment.dataValues);

    return Apartment.handleBeforeCreate(allDataValues);
  };
  Apartment.hook('beforeUpdate', (apartment, opts) => {
    Apartment.handleBeforeUpdate(apartment, opts);
  });

  Apartment.handleBeforeCreate = function(apartment) {
    const { addressStreet, addressZip, addressCountry } = apartment;

    return ( addressStreet && addressZip && addressCountry ) ?
      Apartment.calculateLatLng({ apartment }) : apartment;
  };
  Apartment.hook('beforeCreate', (apartment, opts) => {
    Apartment.handleBeforeCreate(apartment, opts);
  });

  Apartment.hook('beforeDestroy', async (apartment) => {
    const clients = await Client.scope('currentApartment').findAll({
      where: { $and: [
        { '$Rentings->Room.ApartmentId$': apartment.id },
        { '$Rentings.bookingDate$': { $lte:  new Date() } },
      ]},
    });

    if ( clients.length > 0) {
      throw new Error('Cannot delete Apartment: it\'s not empty.');
    }

    return true;
  });
};
