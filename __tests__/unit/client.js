const Promise          = require('bluebird');
const D                = require('date-fns');
const models           = require('../../src/models');
const fixtures         = require('../../__fixtures__/client');

let client;
let client2;
let client3;

let renting2;
let renting3;
let u;

describe('Client', () => {
  beforeAll(() => {
    return fixtures()
      .then(({instances, unique}) => {
        return (
          client = instances['client-1'],
          client2 = instances['client-2'],
          client3 = instances['client-3'],
          renting2 = instances['renting-2'],
          renting3 = instances['renting-3'],
          u = unique
        );
      });
  });

  describe('Scopes', () => {
    test('rentOrders scope find orders where orderItem ProductId equals `rent`', () => {
      return models.Client.scope('rentOrders')
        .findById(client2.id)
        .then((client) => {
          client.Orders.map((order) => {
            return order.OrderItems.map((orderitem) => {
              return expect(orderitem.ProductId).toEqual('rent');
            });
          });
          return expect(client.Orders.length).toEqual(2);
      });
    });

    test('rentOrders scope return no Order as there is no `rent` orderItem', () => {
      return models.Client.scope('rentOrders')
        .findById(client3.id)
        .then((client) => {
          return expect(client.Orders).toHaveLength(0);
      });
    });

    test('roomSwitchCount scope counts the time a client switched room', () => {
      return models.Client.scope('roomSwitchCount')
        .findById(client.id)
        .then((client) => {
          return expect(client.get('roomSwitchCount')).toEqual(1);
        });
    });

    test('uncashedDepositCount count rentings with "do-not-cash" option', () => {
      return models.Client.scope('uncashedDepositCount')
        .findById(client.id)
        .then((client) => {
          return expect(client.get('uncashedDepositCount')).toEqual(1);
        });
    });

    test('currentApartment scope should return current client of a Room', () => {
      return models.Client.scope('currentApartment')
        .findById(client.id)
        .then((client) => {
          return expect(client.Rentings[0].Room.id).toEqual(u.id('room-1'));
        });
    });
    test('currentApartment scope return no Renting as client already checkout', () => {
      return models.Client.scope('currentApartment')
        .findById(client2.id)
        .then((client) => {
          return expect(client.Rentings).toHaveLength(0);
        });
    });
  });

  // describe('#getRentingOrdersFor()', () => {
  //   test('it should find the renting order for a specific month', () => {
  //     return client.getRentingOrdersFor(D.parse('2016-01 Z'))
  //       .then((orders) => {
  //         return expect(orders[0].dueDate).toEqual('2016-01-01');
  //       });
  //   });
  // });

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

  describe('#findOrCreateRentOrder', () => {
    test('it should create an order with appropriate orderitems', () => {
      const _Renting = models.Renting.scope('room+apartment');

      return models.Client.scope('uncashedDepositCount')
        .findById(client.id)
        .then((client) => {
          return Promise.all([
            client,
            _Renting.findById(renting2.id),
            _Renting.findById(renting3.id),
          ]);
        })
        .then(([client, renting2, renting3]) => {
          return client.findOrCreateRentOrder(
            [renting2, renting3],
            D.parse('2017-02 Z'),
            Math.round(Math.random() * 1E12)
          );
        })
        .then(([order, isCreated]) => {
          return (
            expect(isCreated).toEqual(true),
            expect(order.OrderItems.length).toEqual(5)
          );
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
