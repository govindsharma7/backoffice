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
      status: 'active',
    }],
    Order: [{
      id: u.id('order-1'),
      type: 'debit',
      receiptNumber: u.int(1),
      label: 'test order 1',
      ClientId: u.id('client-1'),
      dueDate: D.parse('2016-01-01 Z'),
    }, {
      id: u.id('order-2'),
      type: 'debit',
      receiptNumber: u.int(2),
      label: 'Room switch order',
      ClientId: u.id('client-1'),
      dueDate: D.parse('2016-01-01 Z'),
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
    Renting: [{
      id: u.id('renting-1'),
      bookingDate: '2016-01-01',
      price: '20000',
      serviceFees: 300,
      ClientId: u.id('client-1'),
      RoomId: u.id('room-1'),
    }, {
      id: u.id('renting-2'),
      bookingDate: '2016-01-01',
      price: '20000',
      serviceFees: 300,
      ClientId: u.id('client-1'),
      RoomId: u.id('room-1'),
    }, {
      id: u.id('renting-3'),
      bookingDate: '2017-02-11',
      serviceFees: 300,
      price: '30000',
      ClientId: u.id('client-1'),
      RoomId: u.id('room-1'),
    }],
    OrderItem: [{
      id: u.id('orderitem-1'),
      label: 'test item 1',
      quantity: 1,
      unitPrice: 200,
      vatRate: 0,
      OrderId: u.id('order-1'),
      RentingId: u.id('renting-1'),
    }, {
      id: u.id('orderitem-2'),
      label: 'test item 2',
      quantity: 1,
      unitPrice: 200,
      vatRate: 0,
      OrderId: u.id('order-1'),
      ProductId: 'room-switch',
    }],
    Event: [{
      id: u.id('event-1'),
      summary: 'checkout',
      startDate: '2016-02-03',
      endDate: '2016-02-03',
      eventable: 'Renting',
      EventableId: u.id('renting-1'),
    }, {
      id: u.id('event-2'),
      summary: 'checkout',
      startDate: '2017-02-10',
      endDate: '2017-02-10',
      eventable: 'Renting',
      EventableId: u.id('renting-2'),
    }],
    Term: [{
      name: 'checkout',
      taxonomy: 'event-category',
      termable: 'Event',
      TermableId: u.id('event-1'),
    }, {
      name: 'checkout',
      taxonomy: 'event-category',
      termable: 'Event',
      TermableId: u.id('event-2'),
    }],
  };
});
