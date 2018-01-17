const Promise          = require('bluebird');
const D                = require('date-fns');
const models           = require('../../src/models');
const clientFixtures   = require('../../__fixtures__/client');
const fixtures         = require('../../__fixtures__');

const { Client } = models;

let client;
let client2;

let apartment;

let renting2;
let renting3;
let u;

describe('Client', () => {
  beforeAll(() => {
    return clientFixtures()
      .then(({instances, unique}) => {
        return (
          client = instances['client-1'],
          client2 = instances['client-2'],
          renting2 = instances['renting-2'],
          renting3 = instances['renting-3'],
          apartment = instances['apartment-1'],
          u = unique
        );
      });
  });

  describe('Scopes', () => {
    it('rentOrders scope find orders where orderItem is a `rent`', async() => {
      const { unique: u } = await fixtures((u) => ({
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `john-${u.int(1)}@doe.something`,
        }],
        Order: [{
          id: u.id('order1'),
          label: 'June Invoice',
          ClientId: u.id('client'),
          dueDate: D.parse('2016-01-01 Z'),
        }, {
          id: u.id('order2'),
          label: 'March Invoice',
          ClientId: u.id('client'),
          dueDate: D.parse('2017-07-01 Z'),
        }, {
          id: u.id('order3'),
          label: 'July Invoice',
          ClientId: u.id('client'),
          dueDate: D.parse('2017-03-21 Z'),
        }],
        OrderItem: [{
          id: u.id('orderitem1'),
          label: 'Late Fees',
          OrderId: u.id('order1'),
          ProductId: 'late-fees',
        }, {
          id: u.id('orderitem2'),
          label: 'Rent',
          OrderId: u.id('order1'),
          ProductId: 'rent',
        }, {
          id: u.id('orderitem3'),
          label: 'Rent',
          OrderId: u.id('order2'),
          ProductId: 'rent',
        }],
      }))();

      const client = await Client.scope('rentOrders').findById(u.id('client'));

      client.Orders.forEach((order) =>
        order.OrderItems.map((orderitem) =>
          expect(orderitem.ProductId).toEqual('rent')
        )
      );

      return expect(client.Orders.length).toEqual(2);
    });

    it('rentOrders scope return no Order when there is no `rent` orderItem', async() => {
      const { unique: u } = await fixtures((u) => ({
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `john-${u.int(1)}@doe.something`,
        }],
        Order: [{
          id: u.id('order1'),
          label: 'June Invoice',
          ClientId: u.id('client'),
          dueDate: D.parse('2016-01-01 Z'),
        }, {
          id: u.id('order2'),
          label: 'March Invoice',
          ClientId: u.id('client'),
          dueDate: D.parse('2017-07-01 Z'),
        }],
        OrderItem: [{
          id: u.id('orderitem1'),
          label: 'Late Fees',
          OrderId: u.id('order1'),
          ProductId: 'late-fees',
        }],
      }))();

      const client = await Client.scope('rentOrders').findById(u.id('client'));

      return expect(client.Orders.length).toEqual(0);
    });

    it('roomSwitchCount scope counts the time a client switched room', () => {
      return models.Client.scope('roomSwitchCount')
        .findById(client.id)
        .then((client) => {
          return expect(client.get('roomSwitchCount')).toEqual(1);
        });
    });

    it('uncashedDepositCount count rentings with "do-not-cash" option', () => {
      return models.Client.scope('uncashedDepositCount')
        .findById(client.id)
        .then((client) => {
          return expect(client.get('uncashedDepositCount')).toEqual(1);
        });
    });

    it('currentApartment scope should return current client of a Room', () => {
      return models.Client.scope('currentApartment')
        .findById(client.id)
        .then((client) => {
          return expect(client.Rentings[0].Room.id).toEqual(u.id('room-1'));
        });
    });

    it('currentApartment scope should return current clients of an Apartment', () => {
      return models.Client.scope('currentApartment')
        .findAll({
          where: {
            '$Rentings->Room.ApartmentId$': apartment.id,
            '$Rentings.bookingDate$': { $lte:  new Date() },
            'id': { $ne: client.id },
          },
        })
        .then((clients) => {
         return expect(clients[0].Rentings[0].Room.id).toEqual(u.id('room-2'));
        });
    });
    it('currentApartment scope return no Renting as client already checkout', () => {
      return models.Client.scope('currentApartment')
        .findById(client2.id)
        .then((client) => {
          return expect(client.Rentings).toHaveLength(0);
        });
    });
  });

  // describe('#getRentingOrdersFor()', () => {
  //   it('should find the renting order for a specific month', () => {
  //     return client.getRentingOrdersFor(D.parse('2016-01 Z'))
  //       .then((orders) => {
  //         return expect(orders[0].dueDate).toEqual('2016-01-01');
  //       });
  //   });
  // });

  describe('#getRentingsFor', () => {
    it('should find all rentings for a specific month', () => {
      return client.getRentingsFor(D.parse('2017-02 Z'))
        .then((rentings) => {
          expect(rentings.length).toEqual(2);
          expect(rentings[0].Room).toBeDefined();
          return true;
        });
    });
  });

  describe('#findOrCreateRentOrder', () => {
    it('should create an order with appropriate orderitems', () => {
      const _Renting = models.Renting.scope('room+apartment');

      return models.Client.scope('uncashedDepositCount', 'paymentDelay')
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
          return Promise.all([
            models.Order.findOne({
              where: { id: order.id },
              include: [{ model: models.OrderItem }],
            }),
            isCreated,
          ]);
        })
        .then(([order, isCreated]) => {
          return (
            expect(isCreated).toEqual(true),
            expect(order.OrderItems.length).toEqual(6)
          );
        });
    });
  });

  describe('#ninjaSerialize()', () => {
    it('should serialize the client for InvoiceNinja', () => {
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
    it('should create a draft order with late fees', () => {
      const now = new Date();

      return models.Client
        .findById(client2.id)
        .then((client) => {
          return client.applyLateFees(now);
        })
        .map((order) => {
          return models.OrderItem.findAll({
            where: {
              OrderId: order.id,
              ProductId: 'late-fees',
            },
          })
          .then((orderItems) => {
            return expect(orderItems[0].quantity)
              .toEqual(D.differenceInDays(now, order.dueDate));
          });
        });
    });

    it('shouldn\'t increment late fees as has been update today', () => {
      const now = new Date();

      return models.Client
        .findById(client2.id)
        .then((client) => {
          return client.applyLateFees(now);
        })
        .map((order) => {
          return models.OrderItem.findAll({
            where: {
              OrderId: order.id,
              ProductId: 'late-fees',
            },
          })
          .then((orderItems) => {
            return expect(orderItems[0].quantity)
              .toEqual(D.differenceInDays(now, order.dueDate));
          });
        });
      });
  });

  describe('.getIdentity', () => {
    const { findOne } = models.Metadata;

    beforeAll(() => {
      models.Metadata.findOne = jest.fn(() => Promise.resolve({
          value: JSON.stringify(
            { birthDate: { year: '1986', month: '07', day: '23' } }
          ),
        }));
    });
    afterAll(() => {
      models.Metadata.findOne = findOne;
    });

    it('fetches and parse the identity record of the client', () => {
      return models.Client.getIdentity({})
        .then((identity) => {
          return expect(identity).toEqual({
            birthDate: { year: '1986', month: '07', day: '23' },
            age: D.differenceInYears(new Date(), '1986-07-23 Z'),
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

    it('generates a valid English description of the client', () => {
      return expect(models.Client.getDescriptionEn(client)).toEqual(
        'Victor, 30 years old American young worker'
      );
    });

    it('generates a valid English description of the client', () => {
      return expect(models.Client.getDescriptionFr(client)).toEqual(
        'Victor, jeune actif(ve) américain de 30 ans'
      );
    });
  });

  // describe('.normalizeIdentityRecord', () => {
  //   it('adds nationality and translate country and nationality to FR', () => {
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
