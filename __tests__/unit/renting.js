const D         = require('date-fns');
const Promise   = require('bluebird');
const fixtures  = require('../../__fixtures__/renting');
const Utils     = require('../../src/utils');
const {Renting} = require('../../src/models');

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
          return renting.get('checkinDate');
        })
        .then((checkinDate) => {
          return expect(checkinDate).toEqual(D.parse('2017-05-14 Z'));
        });
    });

    test('checkinDate should be null when there is no checkin event', () => {
      return Renting.scope('checkinDate')
        .findById(renting2.id)
        .then((renting) => {
          return renting.get('checkinDate');
        })
        .then((checkinDate) => {
          return expect(checkinDate).toBeNull();
        });
    });
  });

  describe('#prorate()', () => {
    test('it calculates the prorated price and service fees', () => {
      const scoped = Renting.scope('checkoutDate');

      return Promise.all([
          scoped.findById(renting1.id),
          scoped.findById(renting2.id),
        ])
        .then(([renting1, renting2]) => {
          const result1 = renting1.prorate(D.parse('2015-01 Z'));

          expect(result1).toEqual({
            price: Utils.euroRound(20000 / 31 * 11),
            serviceFees: Utils.euroRound(3000 / 31 * 11),
          });

          const result2 = renting1.prorate(D.parse('2015-02 Z'));

          expect(result2).toEqual({
            price: Utils.euroRound(20000 / 28 * 10),
            serviceFees: Utils.euroRound(3000 / 28 * 10),
          });

          const result3 = renting2.prorate(D.parse('2015-03 Z'));

          expect(result3).toEqual({
            price: Utils.euroRound(20000 / 31 * (31 - 6)),
            serviceFees: Utils.euroRound(3000 / 31 * (31 - 6)),
          });

          return null;
        });
    });
  });
});
