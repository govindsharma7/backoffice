const D                  = require('date-fns');
const fixtures           = require('../../__fixtures__/renting');
const Utils              = require('../../src/utils');
const models             = require('../../src/models');

const {Renting} = models;
var renting1;
var renting2;

describe('Renting', () => {
  beforeAll(() => {
    return fixtures()
      .then(({instances}) => {
        return (
          renting1 = instances['renting-1'],
          renting2 = instances['renting-2']
        );
      });
  });

  describe('scopes', () => {
    test('checkinDate should include the checkin date', () => {
      return Renting.scope('checkinDate')
        .findById(renting1.id)
        .then((renting) => {
          return expect(renting.get('checkinDate')).toEqual(D.parse('2017-05-14 Z'));
        });
    });
    test('checkinDate should be null when there is no checkin event', () => {
      return Renting.scope('checkinDate')
        .findById(renting2.id)
        .then((renting) => {
          return expect(renting.get('checkinDate')).toBeNull();
        });
    });

    test('it should return the comfort level of the housing pack', () => {
      return Renting.scope('comfortLevel')
        .findById(renting1.id)
        .then((renting) => {
          return expect(renting.get('comfortLevel')).toEqual('privilege');
        });
    });
    test('it should return null when there is no housing pack', () => {
      return Renting.scope('comfortLevel')
        .findById(renting2.id)
        .then((renting) => {
          return expect(renting.get('comfortLevel')).toBeNull();
        });
    });
  });


  describe('#findOrCreateCheckinEvent()', () => {
    test('It should\'nt create a checkin event as it already exists', () => {
      return Renting.scope('room+apartment')
        .findOne({
          where: { id: renting1.id },
          include: [{ model: models.Client }],
        })
        .then((renting) => {
          return renting.findOrCreateCheckinEvent('2017-05-16 Z', {hooks:false});
        })
        .then((result) => {
          return expect(result[1]).toEqual(false);
        });
    });

    test('It should create a checkin event', () => {
      return Renting.scope('room+apartment')
        .findOne({
          where: { id: renting2.id },
          include: [{ model: models.Client }],
        })
        .then((renting) => {
          return renting.findOrCreateCheckinEvent('2017-05-16 Z', {hooks:false});
        })
        .then((result) => {
          return expect(result[1]).toEqual(true);
        });
    });
  });

  describe('.prorate()', () => {
    const price = 20000;
    const serviceFees = 3000;
    const get = () => null;

    test('it calculates the prorata for the "booking month"', () => {
      return expect(Renting.prorate({
        price,
        serviceFees,
        bookingDate: D.parse('2015-01-20'),
        get,
      }, D.parse('2015-01 Z'))).toEqual({
        price: Utils.roundBy100(price / 31 * (31 - (20 - 1))),
        serviceFees: Utils.roundBy100(serviceFees / 31 * (31 - (20 - 1))),
      });
    });

    test('it calculates the prorata for "checkout month"', () => {
      return expect(Renting.prorate({
        price,
        serviceFees,
        bookingDate: D.parse('2015-01-20'),
        get: () => D.parse('2015-02-10'),
      }, D.parse('2015-02 Z'))).toEqual({
        price: Utils.roundBy100(price / 28 * 10),
        serviceFees: Utils.roundBy100(serviceFees / 28 * 10),
      });
    });

    test('it calculates the prorata for "booking+checkout month"', () => {
      return expect(Renting.prorate({
        price,
        serviceFees,
        bookingDate: D.parse('2015-03-03'),
        get: () => { return D.parse('2015-03-28'); },
      }, D.parse('2015-03 Z'))).toEqual({
        price: Utils.roundBy100(price / 31 * (28 - 2)),
        serviceFees: Utils.roundBy100(serviceFees / 31 * (28 - 2)),
      });
    });

    test('it bills a full month when checkout is the last day of the month', () => {
      return expect(Renting.prorate({
        price,
        serviceFees,
        bookingDate: D.parse('2015-01-01'),
        get: () => { return D.parse('2015-03-31'); },
      }, D.parse('2015-03 Z'))).toEqual({
        price: Utils.roundBy100(price),
        serviceFees: Utils.roundBy100(serviceFees),
      });
    });

    test('it bills a single day when checkout is the first day of the month', () => {
      return expect(Renting.prorate({
        price,
        serviceFees,
        bookingDate: D.parse('2015-01-01'),
        get: () => { return D.parse('2015-03-01'); },
      }, D.parse('2015-03 Z'))).toEqual({
        price: Utils.roundBy100(price / 31),
        serviceFees: Utils.roundBy100(serviceFees / 31),
      });
    });

    test('it bills a single day when booking is the last day of the month', () => {
      return expect(Renting.prorate({
        price,
        serviceFees,
        bookingDate: D.parse('2015-01-31'),
        get,
      }, D.parse('2015-01 Z'))).toEqual({
        price: Utils.roundBy100(price / 31),
        serviceFees: Utils.roundBy100(serviceFees / 31),
      });
    });
  });

  describe('.getPeriod', () => {
    test('it should return the Renting\'s status', () => {
      const date = D.parse('2017-07-07 Z');

      expect(Renting.getPeriod({
        get: () => { return D.parse('2016-03-03 Z'); },
        bookingDate: D.parse('2016-01-01 Z'),
      }, date)).toEqual('past');
      expect(Renting.getPeriod({
        get: () => { return D.parse('2018-03-03 Z'); },
        bookingDate: D.parse('2017-01-01 Z'),
      }, date)).toEqual('current');
      expect(Renting.getPeriod({
        get: () => { return D.parse('2018-03-03 Z'); },
        bookingDate: D.parse('2018-01-01 Z'),
      }, date)).toEqual('future');
    });
  });

  describe('.calculatePriceAndFees', () => {
    test('it should calculate the price and service fees for the renting', () => {
      const room = {
        basePrice: 9500, // rounding-safe price
        Apartment: { roomCount: 3 },
      };
      const bookingDate = D.parse('2017-08-04 Z'); // 100% date
      const hasTwoOccupants = true;

      return Renting
        .calculatePriceAndFees({ room, bookingDate, hasTwoOccupants })
        .then(({ price, serviceFees }) => {
          expect(price).toEqual(18500);
          expect(serviceFees).toEqual(3000);
          return null;
        });
    });
  });

});
