const D        = require('date-fns');
const fixtures = require('./index');

module.exports = fixtures((u) => {
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
      type: 'debit',
      number: u.int(1),
      label: 'test order 1',
      ClientId: u.id('client-1'),
      dueDate: D.parse('2016-01-01 Z'),
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
      checkoutDate: '2016-02-03',
      price: '20000',
      ClientId: u.id('client-1'),
      RoomId: u.id('room-1'),
    },{
      id: u.id('renting-2'),
      checkinDate: '2016-01-01',
      checkoutDate: '2017-02-10',
      price: '20000',
      ClientId: u.id('client-1'),
      RoomId: u.id('room-1'),
    },{
      id: u.id('renting-3'),
      checkinDate: '2017-02-11',
      price: '30000',
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
