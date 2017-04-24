const D        = require('date-fns');
const fixtures = require('../../__fixtures__/client');

var client;
var u;

describe('Client', () => {
  beforeAll(() => {
    return fixtures()
      .then(({instances, unique}) => {
        client = instances['client-1'];
        u = unique;
      });
  });

  describe('#getRentingOrder()', () => {
    test('it should find the renting order for the current month', () => {
      return client.getRentingOrder(D.parse('2016-01 Z'))
        .then((order) => {
          expect(order.dueDate).toEqual('2016-01-01');
        });
    });
  });

  describe('#ninjaSerialize()', () => {
    test('it should serialize the client for InvoiceNinja', () => {
      return client.ninjaSerialize()
        .then((obj) => {
          expect(obj).toEqual({
            'name': 'John Doe',
            'contact': {
              'email': u.str('john@doe.com'),
              'first_name': 'John',
              'last_name': 'Doe',
            },
          });
        });
    });
  });
});
