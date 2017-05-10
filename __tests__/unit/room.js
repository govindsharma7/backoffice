const fixtures = require('../../__fixtures__/room');
const Utils    = require('../../src/utils');

const now = Date.now();
var room1;

describe('Room', () => {
  beforeAll(() => {
    return fixtures()
      .then(({instances}) => {
        return (
          room1 = instances['room-1']
        );
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
          Utils.getServiceFees(1),
          room1.getCalculatedProps(now),
        ])
        .then(([expected, { serviceFees }]) => {
          return expect(serviceFees).toEqual(expected);
        });
    });
  });
});
