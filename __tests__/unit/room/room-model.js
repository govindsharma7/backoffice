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
    describe('availableAt', () => {
      const now = new Date();
      const oneYearAgo = D.subYears(now, 1);
      const oneMonthAgo = D.subMonths(now, 1);
      const oneMonthFromNow = D.addMonths(now, 1);
      let u;

      beforeAll(async () => {
        const { unique } = await fixtures((u) => ({
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

        u = unique;
      });

      it('can find all rooms from lyon with their availability', async () => {
        const rooms = await models.Room.scope('availableAt').findAll({
          include: [models.Apartment],
          where: {
            '$Apartment.addressCity$': 'lyon',
            'ApartmentId': { $in: [u.id('apartment1'), u.id('apartment2')] },
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

      it('can find only sellable rooms', async () => {
        const scoped = models.Room.scope({
          method: ['availableAt', { availability: 'sellable' }],
        });
        const rooms = await scoped.findAll({
          where: {
            'ApartmentId': { $in: [u.id('apartment1'), u.id('apartment2')] },
          },
        });
        const room1 = rooms.find(({ id }) => id === u.id('room1'));
        const room3 = rooms.find(({ id }) => id === u.id('room3'));

        expect(rooms.length).toEqual(2);
        expect(room1.availableAt).toEqual(oneMonthFromNow);
        expect(room3.availableAt).toEqual(new Date(0));
      });

      it('can find only available rooms', async () => {
        const scoped = models.Room.scope({
          method: ['availableAt', { availability: 'available' }],
        });
        const rooms = await scoped.findAll({
          where: {
            'ApartmentId': { $in: [u.id('apartment1'), u.id('apartment2')] },
          },
        });
        const room3 = rooms.find(({ id }) => id === u.id('room3'));

        expect(rooms.length).toEqual(1);
        expect(room3.availableAt).toEqual(new Date(0));
      });
    });
  });

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
