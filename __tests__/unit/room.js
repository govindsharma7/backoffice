const Promise  = require('bluebird');
const D        = require('date-fns');
const Utils    = require('../../src/utils');
const models   = require('../../src/models');

const getNull = () => null;
const { Room } = models;

describe('Room', () => {
  describe('.getCalculatedProps()', () => {
    const now = new Date();

    test('it calculates the period price using Utils.getPeriodPrice', () => {
      const basePrice = 100;

      return Promise.all([
          Utils.getPeriodCoef(now),
          Room.getCalculatedProps( basePrice, 3, now ),
        ])
        .then(([periodCoef, { periodPrice, serviceFees }]) =>
          expect(periodPrice).toEqual(
            Utils.getPeriodPrice( basePrice, periodCoef, serviceFees )
          )
        );
    });

    test('it calculates correct serviceFees using Utils.getServiceFees', () => {
      const roomCount = 2;

      return Promise.all([
          Utils.getServiceFees(roomCount),
          Room.getCalculatedProps( 100, roomCount, now),
        ])
        .then(([expected, { serviceFees }]) =>
          expect(serviceFees).toEqual(expected)
        );
    });
  });

  describe('.checkAvailability', () => {
    const date = D.parse('2017-07-07 Z');

    test('no Rentings == isAvailable', () =>
      Room.checkAvailability({ rentings: [], date })
        .then((isAvailable) => expect(isAvailable).toEqual(true))
    );

    test('past bookingDate + no checkoutDate == !isAvailable', () =>
      Room.checkAvailability({
          rentings: [{ bookingDate: D.parse('2017-01-01 Z'), get: getNull }],
          date,
        })
        .then((isAvailable) => expect(isAvailable).toEqual(false))
    );

    test('future bookingDate + no checkoutDate == !isAvailable', () =>
      Room.checkAvailability({
          rentings: [{ bookingDate: D.parse('2017-12-12 Z'), get: getNull }],
          date,
        })
        .then((isAvailable) => expect(isAvailable).toEqual(false))
    );

    test('past bookingDate + future checkoutDate == !isAvailable', () =>
      Room.checkAvailability({
          rentings: [{
            bookingDate: D.parse('2017-01-01 Z'),
            get: () => D.parse('2017-12-12'),
          }],
          date,
        })
        .then((isAvailable) => expect(isAvailable).toEqual(false))
    );

    test('past bookingDate + past checkoutDate == !isAvailable', () =>
      Room.checkAvailability({
          rentings: [{
            bookingDate: D.parse('2017-01-01 Z'),
            get: () => D.parse('2017-02-02'),
          }],
          date,
        })
        .then((isAvailable) => expect(isAvailable).toEqual(true))
    );
  });

  describe('.getEarliestAvailability', () => {
    const now = D.parse('2017-06-06');
    const futureDate = D.parse('2017-12-12');
    const futureSat = D.parse('2017-12-16');
    const pastDate = D.parse('2017-02-02');

    test('no Rentings == now', () => Room.getEarliestAvailability({
        Rentings: [],
      }, now)
      .then((date) => expect(date).toBe(now))
    );

    test('past bookingDate + no checkoutDate == !isAvailable', () =>
      Room.getEarliestAvailability({
        Rentings: [{ bookingDate: D.parse('2017-01-01 Z'), get: getNull }],
      }, now)
      .then((date) => expect(date).toEqual(false))
    );

    test('future bookingDate + no checkoutDate == !isAvailable', () =>
      Room.getEarliestAvailability({
        Rentings: [{ bookingDate: D.parse('2017-12-12 Z'), get: getNull }],
      }, now)
      .then((date) => expect(date).toEqual(false))
    );

    test('past bookingDate + future checkoutDate == checkoutDate + 1 day', () =>
      Room.getEarliestAvailability({
        Rentings: [{
          bookingDate: D.parse('2017-01-01 Z'),
          get: () => futureDate,
        }],
      }, now)
      .then((date) => expect(date).toEqual(D.addDays(futureDate, 1)))
    );

    test('past bookingDate + future checkoutDate (Sat) == checkoutDate + 2 days', () =>
      Room.getEarliestAvailability({
        Rentings: [{
          bookingDate: D.parse('2017-01-01 Z'),
          get: () => futureSat,
        }],
      }, now)
      .then((date) => expect(date).toEqual(D.addDays(futureSat, 2)))
    );

    test('past bookingDate + past checkoutDate == now', () =>
      Room.getEarliestAvailability({
        Rentings: [{
          bookingDate: D.parse('2017-01-01 Z'),
          get: () => pastDate,
        }],
      }, now)
      .then((date) => expect(date).toEqual(now))
    );
  });
});
