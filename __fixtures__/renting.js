const fixtures = require('./index');

module.exports = fixtures((u) => {
  return {
    Client:[{
      id: u.id('client-1'),
      firstName: 'John',
      lastName: 'Doe',
      email: u.str('john@doe.com'),
      phoneNumber: '0033612345678',
      status: 'active',
    }],
    Renting: [{
      id: u.id('renting-1'),
      bookingDate: '2015-01-20',
      checkoutDate: '2015-02-10',
      price: 20000,
      serviceFees: 3000,
      ClientId: u.id('client-1'),
      RoomId: u.id('room-1'),
    }, {
      id: u.id('renting-2'),
      bookingDate: '2015-03-03',
      checkoutDate: '2015-03-28',
      price: 20000,
      serviceFees: 3000,
      ClientId: u.id('client-1'),
      RoomId: u.id('room-1'),
    }],
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
