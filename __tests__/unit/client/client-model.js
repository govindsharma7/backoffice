const Promise          = require('bluebird');
const D                = require('date-fns');
const models           = require('../../../src/models');
const fixtures         = require('../../../__fixtures__');

const { Client } = models;

describe('Client - Model', () => {

  describe('Scopes', () => {
    describe('rentOrder', () => {
      it('finds orders where orderItem is a `rent`', async() => {
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

      it('returns no Order when there is no `rent` orderItem', async() => {
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
    });

    describe('roomSwitchCount', () => {
      it('counts the time a client switched room', async () => {
        const { unique: u } = await fixtures((u) => ({
          Client: [{
            id: u.id('client'),
            firstName: 'John',
            lastName: 'Doe',
            email: `john-${u.int(1)}@doe.something`,
          }],
          Order: [{
            id: u.id('order'),
            type: 'debit',
            ClientId: u.id('client'),
            dueDate: D.parse('2016-01-01 Z'),
          }],
          OrderItem: [{
            id: u.id('orderitem'),
            label: 'test item 2',
            unitPrice: 200,
            OrderId: u.id('order'),
            ProductId: 'room-switch',
          }],
        }))();

        const client =
          await models.Client.scope('roomSwitchCount').findById(u.id('client'));

        expect(client.get('roomSwitchCount')).toEqual(1);
      });
    });

    describe('uncashedDepositCount', () => {
      it('counts rentings with "do-not-cash" option', async () => {
        const { unique: u } = await fixtures((u) => ({
          Apartment: [{
            id: u.id('apartment'),
            DistrictId: 'lyon-ainay',
          }],
          Room: [{
            id: u.id('room'),
            ApartmentId: u.id('apartment'),
          }],
          Client: [{
            id: u.id('client'),
            firstName: 'John',
            lastName: 'Doe',
            email: `john-${u.int(1)}@doe.something`,
          }],
          Renting: [{
            id: u.id('renting'),
            ClientId: u.id('client'),
            RoomId: u.id('room'),
            status: 'active',
            bookingDate: D.parse('2016-01-01'),
          }],
          Term: [{
            name: 'do-not-cash',
            taxonomy: 'deposit-option',
            termable: 'Renting',
            TermableId: u.id('renting'),
          }],
        }))();

        const client =
          await models.Client.scope('uncashedDepositCount').findById(u.id('client'));

        expect(client.get('uncashedDepositCount')).toEqual(1);
      });
    });

    describe('currentApartment', () => {
      it('finds the current room & apartment', async () => {
        const now = new Date();
        const oneYearAgo = D.subYears(now, 1);
        const oneMonthAgo = D.subMonths(now, 1);
        const oneMonthFromNow = D.addMonths(now, 1);
        const { unique: u } = await fixtures((u) => ({
          Apartment: [{
            id: u.id('apartment'),
            DistrictId: 'lyon-ainay',
          }],
          Room: [{
            id: u.id('room1'),
            ApartmentId: u.id('apartment'),
          }, {
            id: u.id('room2'),
            ApartmentId: u.id('apartment'),
          }, {
            id: u.id('room3'),
            ApartmentId: u.id('apartment'),
          }],
          Client: [{
            id: u.id('client'),
            firstName: 'John',
            lastName: 'Doe',
            email: `john-${u.int(1)}@doe.something`,
          }],
          Renting: [{
            id: u.id('draft-renting'),
            status: 'draft',
            bookingDate: oneYearAgo,
            ClientId: u.id('client'),
            RoomId: u.id('room1'),
          }, {
            id: u.id('past-renting'),
            status: 'active',
            bookingDate: oneYearAgo,
            ClientId: u.id('client'),
            RoomId: u.id('room1'),
          }, {
            id: u.id('current-renting'),
            status: 'active',
            bookingDate: oneYearAgo,
            ClientId: u.id('client'),
            RoomId: u.id('room2'),
          }, {
            id: u.id('future-renting'),
            status: 'active',
            bookingDate: oneMonthFromNow,
            ClientId: u.id('client'),
            RoomId: u.id('room3'),
          }],
          Event: [{
            type: 'checkout',
            EventableId: u.id('current-renting'),
            eventable: 'Renting',
            startDate: oneMonthFromNow,
            endDate: oneMonthFromNow,
          }, {
            type: 'checkout',
            EventableId: u.id('past-renting'),
            eventable: 'Renting',
            startDate: oneMonthAgo,
            endDate: oneMonthAgo,
          }],
        }))();

        const client =
          await models.Client.scope('currentApartment').findById(u.id('client'));

        expect(client.Rentings[0].Room.id).toEqual(u.id('room2'));
      });

      it('finds no Renting when client already checkout', async () => {
        const now = new Date();
        const oneYearAgo = D.subYears(now, 1);
        const oneMonthAgo = D.subMonths(now, 1);
        const { unique: u } = await fixtures((u) => ({
          Apartment: [{
            id: u.id('apartment'),
            DistrictId: 'lyon-ainay',
          }],
          Room: [{
            id: u.id('room'),
            ApartmentId: u.id('apartment'),
          }],
          Client: [{
            id: u.id('client'),
            firstName: 'John',
            lastName: 'Doe',
            email: `john-${u.int(1)}@doe.something`,
          }],
          Renting: [{
            id: u.id('draft-renting'),
            status: 'draft',
            bookingDate: oneYearAgo,
            ClientId: u.id('client'),
            RoomId: u.id('room'),
          }, {
            id: u.id('past-renting'),
            status: 'active',
            bookingDate: oneYearAgo,
            ClientId: u.id('client'),
            RoomId: u.id('room'),
          }],
          Event: [{
            type: 'checkout',
            EventableId: u.id('past-renting'),
            eventable: 'Renting',
            startDate: oneMonthAgo,
            endDate: oneMonthAgo,
          }],
        }))();

        const client =
          await models.Client.scope('currentApartment').findById(u.id('client'));

        expect(client.Rentings.length).toEqual(0);
      });
    });

    describe('latestApartment', () => {
      it('finds the latest room & apartment of the client', async () => {
        const now = new Date();
        const oneYearAgo = D.subYears(now, 1);
        const oneMonthAgo = D.subMonths(now, 1);
        const oneMonthFromNow = D.addMonths(now, 1);
        const { unique: u } = await fixtures((u) => ({
          Apartment: [{
            id: u.id('apartment'),
            DistrictId: 'lyon-ainay',
          }],
          Room: [{
            id: u.id('room1'),
            ApartmentId: u.id('apartment'),
          }, {
            id: u.id('room2'),
            ApartmentId: u.id('apartment'),
          }, {
            id: u.id('room3'),
            ApartmentId: u.id('apartment'),
          }],
          Client: [{
            id: u.id('client'),
            firstName: 'John',
            lastName: 'Doe',
            email: `john-${u.int(1)}@doe.something`,
          }],
          Renting: [{
            id: u.id('draft-renting'),
            status: 'draft',
            bookingDate: oneYearAgo,
            ClientId: u.id('client'),
            RoomId: u.id('room1'),
          }, {
            id: u.id('past-renting'),
            status: 'active',
            bookingDate: oneYearAgo,
            ClientId: u.id('client'),
            RoomId: u.id('room1'),
          }, {
            id: u.id('current-renting'),
            status: 'active',
            bookingDate: oneYearAgo,
            ClientId: u.id('client'),
            RoomId: u.id('room2'),
          }, {
            id: u.id('future-renting'),
            status: 'active',
            bookingDate: oneMonthFromNow,
            ClientId: u.id('client'),
            RoomId: u.id('room3'),
          }],
          Event: [{
            type: 'checkout',
            EventableId: u.id('current-renting'),
            eventable: 'Renting',
            startDate: oneMonthFromNow,
            endDate: oneMonthFromNow,
          }, {
            type: 'checkout',
            EventableId: u.id('past-renting'),
            eventable: 'Renting',
            startDate: oneMonthAgo,
            endDate: oneMonthAgo,
          }],
        }))();

        const client =
          await models.Client.scope('latestApartment').findById(u.id('client'));

        expect(client.Rentings[0].Room.id).toEqual(u.id('room3'));
      });
    });
  });

  describe('#getRentingsFor', () => {
    it('should find all rentings for a specific month', async () => {
      const { instances: { client } } = await fixtures((u) => ({
        Apartment: [{
          id: u.id('apartment'),
          DistrictId: 'lyon-ainay',
        }],
        Room: [{
          id: u.id('room1'),
          ApartmentId: u.id('apartment'),
        }, {
          id: u.id('room2'),
          ApartmentId: u.id('apartment'),
        }],
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `john-${u.int(1)}@doe.something`,
        }],
        Renting: [{
          id: u.id('draft-renting'),
          status: 'draft',
          bookingDate: '2016-01-01',
          ClientId: u.id('client'),
          RoomId: u.id('room1'),
        }, {
          id: u.id('past-renting'),
          status: 'active',
          bookingDate: '2016-01-01',
          ClientId: u.id('client'),
          RoomId: u.id('room2'),
        }, {
          id: u.id('current-renting1'),
          status: 'active',
          bookingDate: '2016-01-01',
          ClientId: u.id('client'),
          RoomId: u.id('room1'),
        }, {
          id: u.id('current-renting2'),
          status: 'active',
          bookingDate: '2017-02-11',
          ClientId: u.id('client'),
          RoomId: u.id('room2'),
        }, {
          id: u.id('future-renting'),
          status: 'active',
          bookingDate: '2017-03-01',
          ClientId: u.id('client'),
          RoomId: u.id('room1'),
        }],
        Event: [{
          type: 'checkout',
          EventableId: u.id('current-renting1'),
          eventable: 'Renting',
          startDate: D.parse('2017-03-01 Z'),
          endDate: D.parse('2017-03-01 Z'),
        }, {
          type: 'checkout',
          EventableId: u.id('past-renting'),
          eventable: 'Renting',
          startDate: D.parse('2017-01-01 Z'),
          endDate: D.parse('2017-01-01 Z'),
        }],
      }))({ method: 'create', hooks: false });

      const rentings = await client.getRentingsFor(D.parse('2017-02-15 Z'));

      expect(rentings.length).toEqual(2);
      expect(rentings[0].Room).toBeDefined();
    });
  });

  describe('#findOrCreateRentOrder', () => {
    it('creates an order with appropriate orderitems and attaches orphans', async () => {
      const scopedRenting = models.Renting.scope('room+apartment');
      const scopedClient = models.Client.scope('uncashedDepositCount', 'paymentDelay');
      const { unique: u } = await fixtures((u) => ({
        Client:[{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: u.str('john@doe.com'),
          phoneNumber: '0033612345678',
          status: 'active',
        }],
        Apartment: [{
          id: u.id('apartment'),
          DistrictId: 'lyon-ainay',
        }],
        Room: [{
          id: u.id('room'),
          ApartmentId: u.id('apartment'),
        }],
        Renting: [{
          id: u.id('renting1'),
          status: 'active',
          bookingDate: '2016-01-01',
          price: '20000',
          serviceFees: 300,
          ClientId: u.id('client'),
          RoomId: u.id('room'),
        }, {
          id: u.id('renting2'),
          status: 'active',
          bookingDate: '2017-02-11',
          serviceFees: 300,
          price: '30000',
          ClientId: u.id('client'),
          RoomId: u.id('room'),
        }],
        Event: [{
          id: u.id('event1'),
          type: 'checkout',
          summary: 'checkout',
          startDate: D.parse('2016-02-03 -01:00'),
          endDate: D.parse('2016-02-03 -01:00'),
          eventable: 'Renting',
          EventableId: u.id('renting1'),
        }, {
          id: u.id('event2'),
          type: 'checkout',
          summary: 'checkout',
          startDate: D.parse('2017-02-01 -01:00'),
          endDate: D.parse('2017-02-01 -01:00'),
          eventable: 'Renting',
          EventableId: u.id('renting2'),
        }],
        OrderItem: [{
          id: u.id('orphan-item'),
          label: 'test item 10',
          unitPrice: -10000,
          ProductId: 'discount',
          status: 'draft',
          RentingId: u.id('renting1'),
        }],
        Term: [{
          name: 'do-not-cash',
          taxonomy: 'deposit-option',
          termable: 'Renting',
          TermableId: u.id('renting2'),
        }, {
          name: 'Next Rent Invoice',
          taxonomy: 'orderItem-category',
          termable: 'OrderItem',
          TermableId: u.id('orphan-item'),
        }],
      }))();

      const [client, renting1, renting2] = await Promise.all([
        scopedClient.findById(u.id('client')),
        scopedRenting.findById(u.id('renting1')),
        scopedRenting.findById(u.id('renting2')),
      ]);
      const [order, isCreated] = await client.findOrCreateRentOrder(
        [renting1, renting2],
        D.parse('2017-02-01 Z'),
        Math.round(Math.random() * 1E12)
      );

      expect(isCreated).toEqual(true);

      const items = await models.OrderItem.findAll({ where: { OrderId: order.id } });

      // TODO: WOW, the length of the array is the only thing we test?
      // We can probably do better!
      expect(items.length).toEqual(6);
    });
  });

  // describe('#applyLateFees()', () => {
  //   it('should create a draft order with late fees', () => {
  //     const now = new Date();
  //
  //     return models.Client
  //       .findById(client2.id)
  //       .then((client) => {
  //         return client.applyLateFees(now);
  //       })
  //       .map((order) => {
  //         return models.OrderItem.findAll({
  //           where: {
  //             OrderId: order.id,
  //             ProductId: 'late-fees',
  //           },
  //         })
  //         .then((orderItems) => {
  //           return expect(orderItems[0].quantity)
  //             .toEqual(D.differenceInDays(now, order.dueDate));
  //         });
  //       });
  //   });
  //
  //   it('shouldn\'t increment late fees as has been update today', () => {
  //     const now = new Date();
  //
  //     return models.Client
  //       .findById(client2.id)
  //       .then((client) => {
  //         return client.applyLateFees(now);
  //       })
  //       .map((order) => {
  //         return models.OrderItem.findAll({
  //           where: {
  //             OrderId: order.id,
  //             ProductId: 'late-fees',
  //           },
  //         })
  //         .then((orderItems) => {
  //           return expect(orderItems[0].quantity)
  //             .toEqual(D.differenceInDays(now, order.dueDate));
  //         });
  //       });
  //     });
  // });

  describe('.getIdentity', () => {
    it('fetches and parse the identity record of the client', async () => {
      const now = D.parse('2016-01-01 Z');
      const rawIdentity = {
        birthDate: { year: '1986', month: '07', day: '23' },
        passport: 'uploads/cheznestor/123/456/',
        isStudent: true,
        nationalityEn: 'French',
        nationalityFr: 'français',
      };
      const fullIdentity = await models.Client.getFullIdentity({
        client: { firstName: 'John' },
        identityRecord: JSON.stringify(rawIdentity),
        now,
      });

      expect(fullIdentity).toEqual(Object.assign(rawIdentity, {
        age: 29,
        recordUrl:
          'https://eu.jotform.com/server.php?action=getSubmissionPDF&formID=123&sid=456',
        descriptionEn: 'John, 29 years old French student',
        descriptionFr: 'John, étudiant(e) français de 29 ans',
      }));
    });
  });

  describe('.normalizeIdentityRecord', () => {
    it('adds nationality and translate country and nationality to FR', async () => {
      const input = {
        'q01_phoneNumber': { area: '+33', phone: '0671114171' },
        'q02_nationality': 'United States',
        'q03_birthPlace': { last: 'England' },
        'q04_frenchStatus': 'Intern',
        'q06_something': 'else',
      };

      const expected = {
        phoneNumber: '+33671114171',
        nationality: 'United States',
        nationalityEn: 'American',
        nationalityFr: 'américain',
        countryEn: 'United States',
        countryFr: 'États-Unis',
        birthPlace: { last: 'England' },
        birthCountryEn: 'England',
        birthCountryFr: 'Angleterre',
        frenchStatus: 'Intern',
        isStudent: true,
        something: 'else',
      };

      const actual = await models.Client.normalizeIdentityRecord(input);

      expect(actual).toEqual(expected);
    });
  });
});
