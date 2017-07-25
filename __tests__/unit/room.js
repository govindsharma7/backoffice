const Promise  = require('bluebird');
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

  describe('#checkAvailability()', () => {
    test('it returns a boolean if room is available', () => {
      return models.Room.scope('latestRenting')
        .findById(room1.id)
        .then((room) => {
          return Promise.all([
          room.checkAvailability(),
          room.checkAvailability('2107-01-19 Z'),
          ]);
        })
        .then(([available, unavailable]) => {
          return [
            expect(available).toBeTruthy,
            expect(unavailable).toBeFalsy,
          ];
      });
    });
  });
});
