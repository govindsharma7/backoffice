const Promise  = require('bluebird');
const D        = require('date-fns');
const Utils    = require('../../src/utils');
const models   = require('../../src/models');

const now = new Date();
const { Room } = models;

describe('Room', () => {
  describe('.getCalculatedProps()', () => {
    test('it calculates the period price using Utils.getPeriodPrice', () => {
      const basePrice = 100;

      return Promise.all([
          Utils.getPeriodCoef(now),
          Room.getCalculatedProps( basePrice, 3, now ),
        ])
        .then(([periodCoef, { periodPrice, serviceFees }]) => {
          return expect(periodPrice).toEqual(
            Utils.getPeriodPrice( basePrice, periodCoef, serviceFees )
          );
        });
    });

    test('it calculates correct serviceFees using Utils.getServiceFees', () => {
      const roomCount = 2;

      return Promise.all([
          Utils.getServiceFees(roomCount),
          Room.getCalculatedProps( 100, roomCount, now),
        ])
        .then(([expected, { serviceFees }]) => {
          return expect(serviceFees).toEqual(expected);
        });
    });
  });

  describe('.checkAvailability', () => {
    const date = D.parse('2017-07-07 Z');
    const getNull = () => { return null; };

    test('no Rentings == isAvailable', () => {
      return Room.checkAvailability({
          Rentings: [],
        }, date)
        .then((isAvailable) => {
          return expect(isAvailable).toEqual(true);
        });
    });

    test('past bookingDate + no checkoutDate == !isAvailable', () => {
      return Room.checkAvailability({
          Rentings: [{ bookingDate: D.parse('2017-01-01 Z'), get: getNull }],
        }, date)
        .then((isAvailable) => {
          return expect(isAvailable).toEqual(false);
        });
    });

    test('future bookingDate + no checkoutDate == !isAvailable', () => {
      return Room.checkAvailability({
          Rentings: [{ bookingDate: D.parse('2017-12-12 Z'), get: getNull }],
        }, date)
        .then((isAvailable) => {
          return expect(isAvailable).toEqual(false);
        });
    });

    test('past bookingDate + future checkoutDate == !isAvailable', () => {
      return Room.checkAvailability({
          Rentings: [{
            bookingDate: D.parse('2017-01-01 Z'),
            get: () => { return D.parse('2017-12-12'); },
          }],
        }, date)
        .then((isAvailable) => {
          return expect(isAvailable).toEqual(false);
        });
    });

    test('past bookingDate + past checkoutDate == !isAvailable', () => {
      return Room.checkAvailability({
          Rentings: [{
            bookingDate: D.parse('2017-01-01 Z'),
            get: () => { return D.parse('2017-02-02'); },
          }],
        }, date)
        .then((isAvailable) => {
          return expect(isAvailable).toEqual(true);
        });
    });
  });
});
