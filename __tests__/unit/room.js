const Promise  = require('bluebird');
const D        = require('date-fns');
const models   = require('../../src/models');
const fixtures = require('../../__fixtures__/room');
const Utils    = require('../../src/utils');

const now = Date.now();
var room1;
var room2;
var renting2;
var renting4;

describe('Room', () => {
  beforeAll(() => {
    return fixtures()
      .then(({instances}) => {
        return (
          room1 = instances['room-1'],
          room2 = instances['room-2'],
          renting2 = instances['renting-2'],
          renting4 = instances['renting-4']
        );
      });
  });

  describe('Scopes', () => {
    describe('latestRenting', () => {
      test('room includes latest booking date from Renting', () => {
        const scoped = models.Room.scope('latestRenting');

        return Promise.all([
          scoped
            .findById(room1.id)
            .then((room) => {
              expect(room.get('latestRentingId')).toEqual(renting2.id);
              expect(room.get('latestBookingDate')).toEqual(D.parse('2016-01-20'));
              expect(room.get('latestCheckoutDate')).toBeInstanceOf(Date);
              return true;
            }),
          scoped
            .findById(room2.id)
            .then((room) => {
              expect(room.get('latestRentingId')).toEqual(renting4.id);
              expect(room.get('latestBookingDate')).toEqual(D.parse('2017-01-20'));
              expect(room.get('latestCheckoutDate')).toBeInstanceOf(Date);
              return true;
            }),
        ]);
      });
    });
  });

  describe('#getCalculatedProps()', () => {
    test('it calculates the period price using Utils.getPeriodCoef', () => {
      return Promise.all([
          Utils.getPeriodCoef(now),
          room1.getCalculatedProps(now),
        ])
        .then(([periodCoef, { periodPrice }]) => {
          return expect(periodPrice).toEqual(periodCoef * room1.basePrice);
        });
    });

    test('it calculates correct serviceFees using Utils.getServiceFees', () => {
      return Promise.all([
          Utils.getServiceFees(2),
          room1.getCalculatedProps(now),
        ])
        .then(([expected, { serviceFees }]) => {
          return expect(serviceFees).toEqual(expected);
        });
    });
  });
});
