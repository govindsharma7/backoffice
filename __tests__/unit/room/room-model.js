const D        = require('date-fns');
const fixtures = require('../../../__fixtures__');
const Utils    = require('../../../src/utils');
const models   = require('../../../src/models');

// const getNull = () => null;
const { Room } = models;

describe('Room - model', () => {
  describe('virtual properties', () => {
    describe('currentPrice', () => {
      it('returns the price at the future checkoutDate', async () => {
        const oneMonthFromNow = D.addMonths(new Date(), 1);
        const basePrice = 12300;
        const roomCount = 3;
        const periodCoef = await Utils.getPeriodCoef(oneMonthFromNow);
        const { unique: u } = await fixtures((u) => ({
          Apartment: [{
            id: u.id('apartment'),
            DistrictId: 'lyon-ainay',
            roomCount,
          }],
          Room: [{
            id: u.id('room'),
            basePrice,
            ApartmentId: u.id('apartment'),
          }],
          Client: [{
            id: u.id('client'),
            firstName: 'John',
            lastName: 'Doe',
            email: `john-${u.int(1)}@doe.something`,
          }],
          Renting: [{
            id: u.id('renting'),
            status: 'active',
            bookingDate: D.parse('2016-01-01 Z'),
            ClientId: u.id('client'),
            RoomId: u.id('room'),
          }],
          Event: [{
            type: 'checkout',
            EventableId: u.id('renting'),
            eventable: 'Renting',
            startDate: oneMonthFromNow,
            endDate: oneMonthFromNow,
          }],
        }))();

        const room = await Room.scope('availableAt').findById(u.id('room'), {
          include: [models.Apartment],
        });
        const actual = await room.currentPrice;
        const expected = await Utils.getPeriodPrice( basePrice, periodCoef, roomCount );

        expect(actual).toEqual(expected);
      });

      it('returns todays price if the room is already available', async () => {
        const oneMonthAgo = D.subMonths(new Date(), 1);
        const basePrice = 12300;
        const roomCount = 3;
        const periodCoef = await Utils.getPeriodCoef(new Date());
        const { unique: u } = await fixtures((u) => ({
          Apartment: [{
            id: u.id('apartment'),
            DistrictId: 'lyon-ainay',
            roomCount,
          }],
          Room: [{
            id: u.id('room'),
            basePrice,
            ApartmentId: u.id('apartment'),
          }],
          Client: [{
            id: u.id('client'),
            firstName: 'John',
            lastName: 'Doe',
            email: `john-${u.int(1)}@doe.something`,
          }],
          Renting: [{
            id: u.id('renting'),
            status: 'active',
            bookingDate: D.parse('2016-01-01 Z'),
            ClientId: u.id('client'),
            RoomId: u.id('room'),
          }],
          Event: [{
            type: 'checkout',
            EventableId: u.id('renting'),
            eventable: 'Renting',
            startDate: oneMonthAgo,
            endDate: oneMonthAgo,
          }],
        }))();

        const room = await Room.scope('availableAt').findById(u.id('room'), {
          include: [models.Apartment],
        });
        const actual = await room.currentPrice;
        const expected = await Utils.getPeriodPrice( basePrice, periodCoef, roomCount );

        expect(actual).toEqual(expected);
      });

      it('should be null if the room isn\'t available', async () => {
        const basePrice = 12300;
        const roomCount = 3;
        const { unique: u } = await fixtures((u) => ({
          Apartment: [{
            id: u.id('apartment'),
            DistrictId: 'lyon-ainay',
            roomCount,
          }],
          Room: [{
            id: u.id('room'),
            basePrice,
            ApartmentId: u.id('apartment'),
          }],
          Client: [{
            id: u.id('client'),
            firstName: 'John',
            lastName: 'Doe',
            email: `john-${u.int(1)}@doe.something`,
          }],
          Renting: [{
            id: u.id('renting'),
            status: 'active',
            bookingDate: D.parse('2016-01-01 Z'),
            ClientId: u.id('client'),
            RoomId: u.id('room'),
          }],
        }))();

        const room = await Room.scope('availableAt').findById(u.id('room'));
        const actual = await room.currentPrice;

        expect(actual).toBeNull();
      });
    });

    describe('serviceFees', () => {
      it('returns serviceFees calculated when apartment is included', async () => {
        const { unique: u } = await fixtures((u) => ({
          Apartment: [{
            id: u.id('apartment'),
            DistrictId: 'lyon-ainay',
            roomCount: 3,
          }],
          Room: [{
            id: u.id('room'),
            ApartmentId: u.id('apartment'),
          }],
          Client: [{
            id: u.id('client'),
            firstName: 'John',
            lastName: 'Doe',
            email: `john-${u.int(1)}@doe.something`,
          }],
          Renting: [{
            id: u.id('renting'),
            status: 'draft',
            bookingDate: D.parse('2016-01-01 Z'),
            ClientId: u.id('client'),
            RoomId: u.id('room'),
          }],
        }))();

        const room = await Room.scope('availableAt').findById(u.id('room'));
        const actual = await room.serviceFees;

        expect(actual).toEqual(3000);
      });
    });
  });

  describe('scopes', () => {
    describe('availableAt combined with Apartment', () => {
      it('should find all rooms from lyon with their availability', async () => {
        const now = new Date();
        const oneYearAgo = D.subYears(now, 1);
        const oneMonthAgo = D.subMonths(now, 1);
        const oneMonthFromNow = D.addMonths(now, 1);

        const { unique: u } = await fixtures((u) => ({
          Apartment: [{
            id: u.id('apartment1'),
            addressCity: 'lyon',
            DistrictId: 'lyon-ainay',
          }, {
            id: u.id('apartment2'),
            addressCity: 'paris',
            DistrictId: 'lyon-ainay',
          }],
          Room: [{
            id: u.id('room1'),
            ApartmentId: u.id('apartment1'),
          }, {
            id: u.id('room2'),
            ApartmentId: u.id('apartment1'),
          }, {
            id: u.id('room3'),
            ApartmentId: u.id('apartment1'),
          }, {
            id: u.id('room4'),
            ApartmentId: u.id('apartment2'),
          }],
          Client: [{
            id: u.id('client'),
            firstName: 'John',
            lastName: 'Doe',
            email: `john-${u.int(1)}@doe.something`,
          }],
          Renting: [{
            id: u.id('draft-renting'),
            status: 'draft',
            bookingDate: oneYearAgo,
            ClientId: u.id('client'),
            RoomId: u.id('room1'),
          }, {
            id: u.id('past-renting'),
            status: 'active',
            bookingDate: oneYearAgo,
            ClientId: u.id('client'),
            RoomId: u.id('room2'),
          }, {
            id: u.id('current-renting1'),
            status: 'active',
            bookingDate: oneYearAgo,
            ClientId: u.id('client'),
            RoomId: u.id('room1'),
          }, {
            id: u.id('current-renting2'),
            status: 'active',
            bookingDate: oneMonthAgo,
            ClientId: u.id('client'),
            RoomId: u.id('room2'),
          }, {
            id: u.id('current-renting3'),
            status: 'active',
            bookingDate: oneMonthAgo,
            ClientId: u.id('client'),
            RoomId: u.id('room4'),
          }, {
            id: u.id('future-renting'),
            status: 'draft',
            bookingDate: oneMonthFromNow,
            ClientId: u.id('client'),
            RoomId: u.id('room1'),
          }],
          Event: [{
            type: 'checkout',
            EventableId: u.id('current-renting1'),
            eventable: 'Renting',
            startDate: oneMonthFromNow,
            endDate: oneMonthFromNow,
          }, {
            type: 'checkout',
            EventableId: u.id('past-renting'),
            eventable: 'Renting',
            startDate: oneMonthAgo,
            endDate: oneMonthAgo,
          }],
        }))();

        const rooms = await models.Room.scope('availableAt').findAll({
          include: [models.Apartment],
          where: {
            '$Apartment.addressCity$': 'lyon',
            '$Apartment.id$': { $in: [u.id('apartment1'), u.id('apartment2')] },
          },
        });
        const room1 = rooms.find(({ id }) => id === u.id('room1'));
        const room2 = rooms.find(({ id }) => id === u.id('room2'));
        const room3 = rooms.find(({ id }) => id === u.id('room3'));

        expect(rooms.length).toEqual(3);
        expect(room1.availableAt).toEqual(oneMonthFromNow);
        expect(room2.availableAt).toEqual(null);
        expect(room3.availableAt).toEqual(new Date(0));
      });
    });

    describe('currentOccupant', () => {
      it('should find all rooms\' current occupant or availability', async () => {
        const now = new Date();
        const oneYearAgo = D.subYears(now, 1);
        const oneMonthAgo = D.subMonths(now, 1);
        const oneMonthFromNow = D.addMonths(now, 1);

        const { unique: u } = await fixtures((u) => ({
          Apartment: [{
            id: u.id('apartment'),
            DistrictId: 'lyon-ainay',
          }],
          Room: [{
            id: u.id('room1'),
            ApartmentId: u.id('apartment'),
          }, {
            id: u.id('room2'),
            ApartmentId: u.id('apartment'),
          }, {
            id: u.id('room3'),
            ApartmentId: u.id('apartment'),
          }],
          Client: [{
            id: u.id('client1'),
            firstName: 'John',
            lastName: 'Doe',
            email: `john-${u.int(1)}@doe.something`,
          }, {
            id: u.id('client2'),
            firstName: 'Jane',
            lastName: 'Fonda',
            email: `jane-${u.int(1)}@fonda.com`,
          }, {
            id: u.id('client3'),
            firstName: 'Larry',
            lastName: 'Page',
            email: `larry-${u.int(1)}@page.com`,
          }, {
            id: u.id('client4'),
            firstName: 'Sergey',
            lastName: 'Brin',
            email: `sergey-${u.int(1)}@brin.com`,
          }],
          Renting: [{
            id: u.id('past-renting1'),
            status: 'draft',
            bookingDate: oneYearAgo,
            ClientId: u.id('client1'),
            RoomId: u.id('room1'),
          }, {
            id: u.id('current-renting'),
            status: 'active',
            bookingDate: oneMonthAgo,
            ClientId: u.id('client2'),
            RoomId: u.id('room1'),
          }, {
            id: u.id('future-renting'),
            status: 'active',
            bookingDate: oneMonthFromNow,
            ClientId: u.id('client3'),
            RoomId: u.id('room1'),
          }, {
            id: u.id('past-renting2'),
            status: 'active',
            bookingDate: oneYearAgo,
            ClientId: u.id('client4'),
            RoomId: u.id('room2'),
          }],
          Event: [{
            type: 'checkout',
            EventableId: u.id('past-renting1'),
            eventable: 'Renting',
            startDate: oneMonthAgo,
            endDate: oneMonthAgo,
          }, {
            type: 'checkout',
            EventableId: u.id('past-renting2'),
            eventable: 'Renting',
            startDate: oneMonthAgo,
            endDate: oneMonthAgo,
          }, {
            type: 'checkout',
            EventableId: u.id('current-renting'),
            eventable: 'Renting',
            startDate: oneMonthFromNow,
            endDate: oneMonthFromNow,
          }],
          Metadata: [{
            MetadatableId: u.id('client2'),
            metadatable: 'Client',
            name: 'clientIdentity',
            value: JSON.stringify({
              birthDate: { year: '1986', month: '07', day: '23' },
              passport: 'uploads/cheznestor/123/456/',
              isStudent: true,
              nationalityEn: 'French',
              nationalityFr: 'français',
            }),
          }],
        }))();

        const rooms = await models.Room.scope('currentOccupant').findAll({
          where: { ApartmentId: u.id('apartment') },
        });
        const room1 = rooms.find(({ id }) => id === u.id('room1'));
        const room2 = rooms.find(({ id }) => id === u.id('room2'));
        const room3 = rooms.find(({ id }) => id === u.id('room3'));

        const client2Identity = models.Client.getFullIdentity({
          client: room1.Rentings[0].Client,
          identityMeta: room1.Rentings[0].Client.Metadata[0],
          now: D.parse('2016-01-01 Z'),
        });

        expect(rooms.length).toEqual(3);
        expect(room1.Rentings[0].ClientId).toEqual(u.id('client2'));
        expect(room2.Rentings.length).toEqual(0);
        expect(room3.Rentings.length).toEqual(0);
        expect(room1.availableAt).toBeNull();
        expect(room2.availableAt).toEqual(new Date(0));
        expect(room3.availableAt).toEqual(new Date(0));
        expect(client2Identity.descriptionEn)
          .toEqual('Jane, 29 years old French student');
      });
    });
  });

  // describe('.checkAvailability', () => {
  //   const date = D.parse('2017-07-07 Z');
  //
  //   test('no Rentings == isAvailable', () =>
  //     Room.checkAvailability({ rentings: [], date })
  //       .then((isAvailable) => expect(isAvailable).toEqual(true))
  //   );
  //
  //   test('past bookingDate + no checkoutDate == !isAvailable', () =>
  //     Room.checkAvailability({
  //         rentings: [{ bookingDate: D.parse('2017-01-01 Z'), get: getNull }],
  //         date,
  //       })
  //       .then((isAvailable) => expect(isAvailable).toEqual(false))
  //   );
  //
  //   test('future bookingDate + no checkoutDate == !isAvailable', () =>
  //     Room.checkAvailability({
  //         rentings: [{ bookingDate: D.parse('2017-12-12 Z'), get: getNull }],
  //         date,
  //       })
  //       .then((isAvailable) => expect(isAvailable).toEqual(false))
  //   );
  //
  //   test('past bookingDate + future checkoutDate == !isAvailable', () =>
  //     Room.checkAvailability({
  //         rentings: [{
  //           bookingDate: D.parse('2017-01-01 Z'),
  //           get: () => D.parse('2017-12-12'),
  //         }],
  //         date,
  //       })
  //       .then((isAvailable) => expect(isAvailable).toEqual(false))
  //   );
  //
  //   test('past bookingDate + past checkoutDate == !isAvailable', () =>
  //     Room.checkAvailability({
  //         rentings: [{
  //           bookingDate: D.parse('2017-01-01 Z'),
  //           get: () => D.parse('2017-02-02'),
  //         }],
  //         date,
  //       })
  //       .then((isAvailable) => expect(isAvailable).toEqual(true))
  //   );
  // });
  //
  // describe('.getEarliestAvailability', () => {
  //   const now = D.parse('2017-06-06');
  //   const futureDate = D.parse('2017-12-12');
  //   const futureSat = D.parse('2017-12-16');
  //   const pastDate = D.parse('2017-02-02');
  //
  //   test('no Rentings == now', () => Room.getEarliestAvailability({
  //       rentings: [],
  //       now,
  //     })
  //     .then((date) => expect(date).toBe(now))
  //   );
  //
  //   test('past bookingDate + no checkoutDate == !isAvailable', () =>
  //     Room.getEarliestAvailability({
  //       rentings: [{ bookingDate: D.parse('2017-01-01 Z'), get: getNull }],
  //       now,
  //     })
  //     .then((date) => expect(date).toEqual(false))
  //   );
  //
  //   test('future bookingDate + no checkoutDate == !isAvailable', () =>
  //     Room.getEarliestAvailability({
  //       rentings: [{ bookingDate: D.parse('2017-12-12 Z'), get: getNull }],
  //       now,
  //     })
  //     .then((date) => expect(date).toEqual(false))
  //   );
  //
  //   test('past bookingDate + future checkoutDate == checkoutDate + 1 day', () =>
  //     Room.getEarliestAvailability({
  //       rentings: [{
  //         bookingDate: D.parse('2017-01-01 Z'),
  //         get: () => futureDate,
  //       }],
  //       now,
  //     })
  //     .then((date) => expect(date).toEqual(D.addDays(futureDate, 1)))
  //   );
  //
  //   test('past bookingDate + future checkoutDate (Sat) == checkoutDate + 2 days', () =>
  //     Room.getEarliestAvailability({
  //       rentings: [{
  //         bookingDate: D.parse('2017-01-01 Z'),
  //         get: () => futureSat,
  //       }],
  //       now,
  //     })
  //     .then((date) => expect(date).toEqual(D.addDays(futureSat, 2)))
  //   );
  //
  //   test('past bookingDate + past checkoutDate == now', () =>
  //     Room.getEarliestAvailability({
  //       rentings: [{
  //         bookingDate: D.parse('2017-01-01 Z'),
  //         get: () => pastDate,
  //       }],
  //       now,
  //     })
  //     .then((date) => expect(date).toEqual(now))
  //   );
  // });

  describe('.getPriceAndFees', () => {
    test('it should calculate the price and service fees for the renting', async () => {
      const room = { basePrice: 9500 }; // rounding-safe price
      const apartment = { roomCount: 3 };
      const date = D.parse('2017-08-04 Z'); // 100% date
      const { price, serviceFees } =
        await Room.getPriceAndFees({ room, apartment, date });

      expect(price).toEqual(9500);
      expect(serviceFees).toEqual(3000);
    });
  });
});
