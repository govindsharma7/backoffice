const Promise          = require('bluebird');
const D                = require('date-fns');
const models           = require('../../src/models');
const fixtures         = require('../../__fixtures__/client');

var client;
var client2;
var renting2;
var renting3;
var u;

describe('Client', () => {
  beforeAll(() => {
    return fixtures()
      .then(({instances, unique}) => {
        return (
          client = instances['client-1'],
          client2 = instances['client-2'],
          renting2 = instances['renting-2'],
          renting3 = instances['renting-3'],
          u = unique
        );
      });
  });

  describe('scopes', () => {
    test('roomSwitchCount scope counts the time a client switched room', () => {
      return models.Client.scope('roomSwitchCount')
        .findById(client.id)
        .then((client) => {
          return expect(client.get('roomSwitchCount')).toEqual(1);
        });
    });
  });

  describe('#getRentingOrdersFor()', () => {
    test('it should find the renting order for a specific month', () => {
      return client.getRentingOrdersFor(D.parse('2016-01 Z'))
        .then((orders) => {
          return expect(orders[0].dueDate).toEqual('2016-01-01');
        });
    });
  });

  describe('#getRentingsFor', () => {
    test('it should find all rentings for a specific month', () => {
      return client.getRentingsFor(D.parse('2017-02 Z'))
        .then((rentings) => {
          expect(rentings.length).toEqual(2);
          expect(rentings[0].Room).toBeDefined();
          return true;
        });
    });
  });



  describe('#createRentingsOrder', () => {
    test('it should create an order with appropriate orderitems', () => {
      const _Renting = models.Renting.scope('room+apartment');

      return Promise.all([
        Promise.all([
          _Renting.findById(renting2.id),
          _Renting.findById(renting3.id),
        ]),
        client.hasUncashedDeposit(),
        ])
        .then(([rentings, uncashedDeposit]) => {
          return client.createRentingsOrder(
            rentings,
            uncashedDeposit,
            D.parse('2017-02 Z'),
            Math.round(Math.random() * 1E12)
          );
        })
        .then((order) => {
          return order.getOrderItems();
        })
        .then((orderItems) => {
          return expect(orderItems.length).toEqual(5);
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

  describe('#claculateTodaysLateFees()', () => {
    test('it should return late fee amount for a client', () => {
      return models.Client.scope('rentOrders')
        .findById(client2.id)
        .then((client) => {
            return client.calculateTodaysLateFees();
        })
        .then((lateFees) => {
          expect(lateFees).toEqual(1000);
          return true;
        });
    });
  });

  describe('#hasUncashedDeposit', () => {
    test('it should return true if client have an uncashed deposit', () => {
      return client.hasUncashedDeposit()
        .then((result) => {
          expect(result).toEqual(true);
          return true;
      });
    });
    test('it should return false as client2 didn\'t pay his deposit', () => {
      return client2.hasUncashedDeposit()
        .then((result) => {
          expect(result).toEqual(false);
          return true;
      });
    });
  });

  describe('#applyLateFees()', () => {
    test('it should create a draft order with late fees', () => {
      return models.Client.scope('rentOrders')
        .findById(client2.id)
        .then((client) => {
          return client.applyLateFees();
        })
        .then((result) => {
          expect(result.OrderItems[0].unitPrice).toEqual(1000);
          return true;
        });
    });

    test('it shouldn\'t increment late fees as it has been update today', () => {
      return models.Client.scope('rentOrders')
        .findById(client2.id)
        .then((client) => {
          return client.applyLateFees();
        })
        .then((order) => {
          return order.reload({paranoid: false});
        })
        .then((order) => {
          expect(order.OrderItems[0].unitPrice).toEqual(1000);
          return true;
        });
      });
  });

});
