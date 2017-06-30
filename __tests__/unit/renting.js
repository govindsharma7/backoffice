const D         = require('date-fns');
const Promise   = require('bluebird');
const fixtures  = require('../../__fixtures__/renting');
const Utils     = require('../../src/utils');
const models    = require('../../src/models');

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
    test('It should\'nt create a checkin event when one already exists', () => {
      return renting1
        .findOrCreateCheckinEvent('2017-05-16 Z', {hooks:false})
        .then((result) => {
          return expect(result[1]).toEqual(false);
        });
    });

    test('It should create a checkin event', () => {
      return renting2.findOrCreateCheckinEvent('2017-05-16 Z', {hooks:false})
        .then((result) => {
          return expect(result[1]).toEqual(true);
        });
    });
  });

  describe('#prorate()', () => {
    test('it calculates the prorated price and service fees', () => {
      return Promise.all([
          renting1.prorate(D.parse('2015-01 Z')),
          renting1.prorate(D.parse('2015-02 Z')),
          renting2.prorate(D.parse('2015-03 Z')),
        ])
        .then(([result1, result2, result3]) => {
          expect(result1).toEqual({
            price: Utils.roundBy100(20000 / 31 * (31 - (20 - 1))),
            serviceFees: Utils.roundBy100(3000 / 31 * (31 - (20 - 1))),
          });
          expect(result2).toEqual({
            price: Utils.roundBy100(20000 / 28 * 10),
            serviceFees: Utils.roundBy100(3000 / 28 * 10),
          });
          expect(result3).toEqual({
            price: Utils.roundBy100(20000 / 31 * (28 - 2)),
            serviceFees: Utils.roundBy100(3000 / 31 * (28 - 2)),
          });

          return null;
        });
    });
  });

});
