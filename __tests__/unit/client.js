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
          return expect(client.Orders.length).toEqual(3);
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
            D.parse('2017-02-01 Z'),
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

  describe('#applyLateFees()', () => {
    test('it should create a draft order with late fees', () => {
      return models.Client
        .findById(client2.id)
        .then((client) => {
          return client.applyLateFees();
        })
        .map((order) => {
          return order.getOrderItems({
            where: {ProductId: 'late-fees'},
          })
          .then((orderItems) => {
            return expect(orderItems[0].quantity)
              .toEqual(D.differenceInDays(Date.now(), order.dueDate));
          });
        });
    });

    test('it shouldn\'t increment late fees as it has been update today', () => {
      return models.Client
        .findById(client2.id)
        .then((client) => {
          return client.applyLateFees();
        })
        .map((order) => {
          return order.getOrderItems({
            where: {ProductId: 'late-fees'},
          })
          .then((orderItems) => {
            return expect(orderItems[0].quantity)
              .toEqual(D.differenceInDays(Date.now(), order.dueDate));
          });
        });
      });
  });

  describe('.getIdentity', () => {
    test('it fetches and parse the identity record of the client', () => {
      return models.Client
        .getIdentity({}, { findOne: () => {
            return Promise.resolve({ value: JSON.stringify(
              { birthDate: { year: '1986', month: '07', day: '23' } }
            ) });
          } }
        )
        .then((identity) => {
          return expect(identity).toEqual({
            birthDate: { year: '1986', month: '07', day: '23' },
            age: D.differenceInYears(Date.now(), '1986-07-23 Z'),
          });
        });
    });
  });

  describe('.getDescriptionEn/Fr', () => {
    const client = {
      firstName: 'Victor',
      identity: {
        age: 30,
        nationalityEn: 'American',
        nationalityFr: 'américain',
        isStudent: false,
      },
    };

    test('it generates a valid English description of the client', () => {
      return expect(models.Client.getDescriptionEn(client)).toEqual(
        'Victor, 30 years old American young worker'
      );
    });

    test('it generates a valid English description of the client', () => {
      return expect(models.Client.getDescriptionFr(client)).toEqual(
        'Victor, jeune actif(ve) américain de 30 ans'
      );
    });
  });

  // describe('.normalizeIdentityRecord', () => {
  //   test('it adds nationality and translate country and nationality to FR', () => {
  //     const input = {
  //       'q01_phoneNumber': { area: '+33', phone: '0671114171' },
  //       'q02_nationality': 'United States',
  //       'q03_birthPlace': { last: 'England' },
  //       'q04_frenchStatus': 'Intern',
  //       'q06_something': 'else',
  //     };
  //
  //     const expected = {
  //       phoneNumber: '+33671114171',
  //       nationality: 'United States',
  //       nationalityEn: 'American',
  //       nationalityFr: 'américain',
  //       countryEn: 'United States',
  //       countryFr: 'États-Unis',
  //       birthPlace: { last: 'England' },
  //       birthCountryEn: 'England',
  //       birthCountryFr: 'Angleterre',
  //       frenchStatus: 'Intern',
  //       isStudent: true,
  //       something: 'else',
  //     };
  //
  //     return models.Client
  //       .normalizeIdentityRecord(input)
  //       .then((result) => {
  //         return expect(result).toEqual(expected);
  //       });
  //   });
  // });

});
