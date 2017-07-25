const Promise  = require('bluebird');
const D        = require('date-fns');
const models   = require('../../src/models');
const fixtures = require('../../__fixtures__/room');
const Utils    = require('../../src/utils');

const now = Date.now();
var room1;

describe('Room', () => {
  beforeAll(() => {
    return fixtures()
      .then(({instances}) => {
        return room1 = instances['room-1'];
      });
  });

  describe('#getCalculatedProps()', () => {
    test('it calculates the period price using Utils.getPeriodPrice', () => {
      return models.Room.scope('apartment')
        .findById(room1.id)
        .then((room) => {
          return Promise.all([
            Utils.getPeriodCoef(now),
            room.getCalculatedProps(now),
          ]);
        })
        .then(([periodCoef, { periodPrice, serviceFees }]) => {
          return expect(periodPrice).toEqual(
            Utils.getPeriodPrice( room1.basePrice, periodCoef, serviceFees )
          );
        });
    });

    test('it calculates correct serviceFees using Utils.getServiceFees', () => {
      return models.Room.scope('apartment')
        .findById(room1.id)
        .then((room) => {
          return Promise.all([
            Utils.getServiceFees(2),
            room.getCalculatedProps(now),
          ]);
        })
        .then(([expected, { serviceFees }]) => {
          return expect(serviceFees).toEqual(expected);
        });
    });
  });

  describe('.checkAvailability', () => {
    const date = D.parse('2017-07-07 Z');
    const getNull = () => { return null; };

    test('no Rentings == isAvailable', () => {
      return models.Room.checkAvailability({
          Rentings: [],
        }, date)
        .then((isAvailable) => {
          return expect(isAvailable).toEqual(true);
        });
    });

    test('past bookingDate + no checkoutDate == !isAvailable', () => {
      return models.Room.checkAvailability({
          Rentings: [{ bookingDate: D.parse('2017-01-01 Z'), get: getNull }],
        }, date)
        .then((isAvailable) => {
          return expect(isAvailable).toEqual(false);
        });
    });

    test('future bookingDate + no checkoutDate == !isAvailable', () => {
      return models.Room.checkAvailability({
          Rentings: [{ bookingDate: D.parse('2017-12-12 Z'), get: getNull }],
        }, date)
        .then((isAvailable) => {
          return expect(isAvailable).toEqual(false);
        });
    });

    test('past bookingDate + future checkoutDate == !isAvailable', () => {
      return models.Room.checkAvailability({
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
      return models.Room.checkAvailability({
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
