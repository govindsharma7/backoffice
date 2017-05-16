const D        = require('date-fns');
const fixtures = require('./index');

module.exports = fixtures((u) => {
  const room = {
    name: 'chambre',
    floorArea: 16,
    basePrice: 598,
    ApartmentId: u.id('apartment-1'),
  };
  const renting = {
    price: 20000,
    serviceFees: 3000,
    ClientId: u.id('client-1'),
  };

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
    Room: [
      Object.assign({
        id: u.id('room-1'),
        reference: u.str('09DUN11'),
      }, room),
      Object.assign({
        id: u.id('room-2'),
        reference: u.str('09DUN12'),
      }, room),
    ],
    Client:[{
      id: u.id('client-1'),
      firstName: 'John',
      lastName: 'Doe',
      email: u.str('john@doe.com'),
      phoneNumber: '0033612345678',
      status: 'active',
    }],
    Renting: [
      Object.assign({
        id: u.id('renting-1'),
        bookingDate: D.parse('2015-01-20 Z'),
        checkoutDate: D.parse('2016-01-20 Z'),
        RoomId: u.id('room-1'),
      }, renting),
      Object.assign({
        id: u.id('renting-2'),
        bookingDate: D.parse('2016-01-20 Z'),
        checkoutDate: D.parse('2015-01-20 Z'),
        RoomId: u.id('room-1'),
      }, renting),
      Object.assign({
        id: u.id('renting-3'),
        bookingDate: D.parse('2015-01-20 Z'),
        checkoutDate: D.parse('2017-01-20 Z'),
        RoomId: u.id('room-2'),
      }, renting),
      Object.assign({
        id: u.id('renting-4'),
        bookingDate: D.parse('2017-01-20 Z'),
        checkoutDate: D.parse('2016-02-20 Z'),
        RoomId: u.id('room-2'),
      }, renting),
      Object.assign({
        id: u.id('renting-5'),
        bookingDate: D.parse('2016-01-20 Z'),
        checkoutDate: D.parse('2015-01-20 Z'),
        RoomId: u.id('room-2'),
      }, renting),
    ],
  };
});
