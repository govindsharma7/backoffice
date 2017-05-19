const D        = require('date-fns');
const fixtures = require('../../__fixtures__/renting');
const Utils    = require('../../src/utils');

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

  describe('#prorate()', () => {
    test('it calculates the prorated price and service fees', () => {
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
    });
  });
});
