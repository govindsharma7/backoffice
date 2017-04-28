const D        = require('date-fns');
const fixtures = require('../../__fixtures__/client');

var client;
var u;

describe('Client', () => {
  beforeAll(() => {
    return fixtures()
      .then(({instances, unique}) => {
        return (
          client = instances['client-1'],
          u = unique
        );
      });
  });

  describe('#getRentingOrders()', () => {
    test('it should find the renting order for a specific month', () => {
      return client.getRentingOrders(D.parse('2016-01 Z'))
        .then((orders) => {
          return expect(orders[0].dueDate).toEqual('2016-01-01');
        });
    });
  });

  describe('#getRentingsForMonth', () => {
    test('it should find all rentings for a specific month', () => {
      return client.getRentingsForMonth(D.parse('2017-02 Z'))
        .then((rentings) => {
          return expect(rentings.length).toEqual(2);
        });
    });
  });

  describe('#createRentingOrder', () => {
    test('it should create an order with appropriate orderitems', () => {
      return client.createRentingOrder(
          D.parse('2017-02 Z'),
          Math.round(Math.random() * 1E12)
        )
        .then((order) => {
          return order.getOrderItems();
        })
        .then((orderItems) => {
          return expect(orderItems.length).toEqual(4);
        });
    });
  });

  describe('#ninjaSerialize()', () => {
    test('it should serialize the client for InvoiceNinja', () => {
      return client.ninjaSerialize()
        .then((obj) => {
          return expect(obj).toEqual({
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
