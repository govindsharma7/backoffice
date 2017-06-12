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
    }, {
      id: u.id('client-2'),
      firstName: 'Colette',
      lastName: 'Cormier',
      email: u.str('colette@cormier.com'),
      phoneNumber: '0033687654321',
      status: 'active',
    }, {
      id: u.id('client-3'),
      firstName: 'Joy',
      lastName: 'Boulé',
      email: u.str('joy@boule.com'),
      phoneNumber: '0033654321678',
      status: 'active',
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
    }, {
      id: u.id('room-2'),
      reference: u.str('09DUN12'),
      name: 'chambre',
      floorArea: 18,
      basePrice: 650,
      ApartmentId: u.id('apartment-1'),
    }],
    Renting: [{
      id: u.id('renting-1'),
      bookingDate: '2015-01-20',
      price: 20000,
      serviceFees: 3000,
      ClientId: u.id('client-1'),
      RoomId: u.id('room-1'),
    }, {
      id: u.id('renting-2'),
      bookingDate: '2015-03-03',
      price: 20000,
      serviceFees: 3000,
      ClientId: u.id('client-2'),
      RoomId: u.id('room-2'),
    }, {
      id: u.id('renting-3'),
      bookingDate: '2015-03-03',
      price: 20000,
      serviceFees: 3000,
      ClientId: u.id('client-3'),
      RoomId: u.id('room-2'),
    }],
    Event: [{
      id: u.id('event-1'),
      startDate: D.parse('2017-05-14 Z'),
      endDate: '2017-05-16',
      eventable: 'Renting',
      EventableId: u.id('renting-1'),
    }, {
      id: u.id('event-2'),
      startDate: D.parse('2017-12-10 Z'),
      endDate: '2017-12-10',
      eventable: 'Renting',
      EventableId: u.id('renting-1'),
    }, {
      id: u.id('event-3'),
      startDate: D.parse('2017-03-28 Z'),
      endDate: '2017-03-28',
      eventable: 'Renting',
      EventableId: u.id('renting-2'),
    }, {
      id: u.id('event-4'),
      startDate: D.parse('2016-03-28 Z'),
      endDate: '2016-03-28',
      eventable: 'Renting',
      EventableId: u.id('renting-3'),
    }],
    Term: [{
      name: 'checkin',
      taxonomy: 'event-category',
      termable: 'Event',
      TermableId: u.id('event-1'),
    }, {
      name: 'checkout',
      taxonomy: 'event-category',
      termable: 'Event',
      TermableId: u.id('event-2'),
    }, {
      name: 'checkin',
      taxonomy: 'event-category',
      termable: 'Event',
      TermableId: u.id('event-3'),
    }, {
      name: 'checkout',
      taxonomy: 'event-category',
      termable: 'Event',
      TermableId: u.id('event-4'),
    }],
    OrderItem: [{
      id: u.id('orderItem-1'),
      label: 'Housing pack',
      ProductId: 'privilege-pack',
      RentingId: u.id('renting-1'),
    }],
  };
});