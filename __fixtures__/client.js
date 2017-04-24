const models = require('../src/models');
const fixtures = require('./fixtures');

module.exports = fixtures(models)((u) => {
  return {
    Client:[{
      id: u.id('client-1'),
      firstName: 'John',
      lastName: 'Doe',
      email: u.str('john@doe.com'),
      phoneNumber: '0033612345678',
    }],
    Order: [{
      id: u.id('order-1'),
      type: 'invoice',
      number: u.int(1),
      label: 'test order 1',
      ClientId: u.id('client-1'),
      dueDate: '2016-01-01',
    }],
    OrderItem: [{
      id: u.id('orderitem-1'),
      label: 'test item 1',
      quantity: 1,
      unitPrice: 200,
      vatRate: 0,
      OrderId: u.id('order-1'),
      RentingId: u.id('renting-1'),
    }],
    Renting: [{
      id: u.id('renting-1'),
      checkinDate: '2016-01-01',
      price: '20000',
      ClientId: u.id('client-1'),
      RoomId: u.id('room-1'),
    }],
    Apartment: [{
      id: u.id('apartment-1'),
      reference: u.str('09DUN2'),
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
      reference: u.str('09DUN21'),
      name: '9 henri dunant - chambre 1',
      floorArea: 16,
      basePrice: 598,
      ApartmentId: u.id('apartment-1'),
    }],
  };
});
