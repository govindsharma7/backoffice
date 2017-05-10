const fixtures = require('./index');

module.exports = fixtures((u) => {
  return {
    Apartment: [{
      id: u.id('apartment-1'),
      reference: u.str('09DUN1'),
      name: '9 henri dunant',
      addressStreet: '9 Rue Henri Dunant',
      addressZip: 34000,
      addressCity: 'montpellier',
      addressCountry: 'france',
      latLng: '43.626936,3.8689535999999407',
      floorArea: 60,
    }],
    Room: [{
      id: u.id('room-1'),
      reference: u.str('09DUN11'),
      name: 'chambre',
      floorArea: 16,
      basePrice: 598,
      ApartmentId: u.id('apartment-1'),
    }],
  };
});
