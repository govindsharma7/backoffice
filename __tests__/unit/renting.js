jest.mock('../../src/vendor/sendinblue');
jest.mock('../../src/vendor/wordpress');

const D                   = require('date-fns');
const Promise             = require('bluebird');
const fixtures            = require('../../__fixtures__');
const rentingFixtures     = require('../../__fixtures__/renting');
const Wordpress           = require('../../src/vendor/wordpress');
const Sendinblue          = require('../../src/vendor/sendinblue');
const Utils               = require('../../src/utils');
const models              = require('../../src/models');

const { Renting } = models;
let renting1;
let renting2;

describe('Renting', () => {
  beforeAll(() => {
    return rentingFixtures()
      .then(({instances}) => {
        renting1 = instances['renting-1'];
        renting2 = instances['renting-2'];

        return null;
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
    test('It should\'nt create a checkin event as it already exists', () => {
      return Renting.scope('room+apartment')
        .findOne({
          where: { id: renting1.id },
          include: [{ model: models.Client }],
        })
        .then((renting) => {
          return renting.findOrCreateCheckinEvent('2017-05-16 Z', {hooks:false});
        })
        .then((result) => {
          return expect(result[1]).toEqual(false);
        });
    });

    test('It should create a checkin event', () => {
      return Renting.scope('room+apartment')
        .findOne({
          where: { id: renting2.id },
          include: [{ model: models.Client }],
        })
        .then((renting) => {
          return renting.findOrCreateCheckinEvent('2017-05-16 Z', {hooks:false});
        })
        .then((result) => {
          return expect(result[1]).toEqual(true);
        });
    });
  });

  describe('.prorate()', () => {
    const price = 20000;
    const serviceFees = 3000;
    const get = () => null;

    test('it calculates the prorata for the "booking month"', () => {
      const actual = Renting.prorate({
        renting: {
          price,
          serviceFees,
          bookingDate: D.parse('2015-01-20'),
          get,
        },
        date: D.parse('2015-01 Z'),
      });
      const expected = {
        price: Utils.roundBy100(price / 31 * (31 - (20 - 1))),
        serviceFees: Utils.roundBy100(serviceFees / 31 * (31 - (20 - 1))),
      };

      return expect(actual).toEqual(expected);
    });

    test('it calculates the prorata for "checkout month"', () => {
      const actual = Renting.prorate({
        renting: {
          price,
          serviceFees,
          bookingDate: D.parse('2015-01-20'),
          get: () => D.parse('2015-02-10'),
        },
        date: D.parse('2015-02 Z'),
      });
      const expected = {
        price: Utils.roundBy100(price / 28 * 10),
        serviceFees: Utils.roundBy100(serviceFees / 28 * 10),
      };

      return expect(actual).toEqual(expected);
    });

    test('it calculates the prorata for "booking+checkout month"', () => {
      const actual = Renting.prorate({
        renting: {
          price,
          serviceFees,
          bookingDate: D.parse('2015-03-03'),
          get: () => D.parse('2015-03-28'),
        },
        date: D.parse('2015-03 Z'),
      });
      const expected = {
        price: Utils.roundBy100(price / 31 * (28 - 2)),
        serviceFees: Utils.roundBy100(serviceFees / 31 * (28 - 2)),
      };

      return expect(actual).toEqual(expected);
    });

    test('it bills a full month when checkout is the last day of the month', () => {
      const actual = Renting.prorate({
        renting: {
          price,
          serviceFees,
          bookingDate: D.parse('2015-01-01'),
          get: () => D.parse('2015-03-31'),
        },
        date: D.parse('2015-03 Z'),
      });
      const expected = {
        price: Utils.roundBy100(price),
        serviceFees: Utils.roundBy100(serviceFees),
      };

      return expect(actual).toEqual(expected);
    });

    test('it bills a single day when checkout is the first day of the month', () => {
      const actual = Renting.prorate({
        renting: {
          price,
          serviceFees,
          bookingDate: D.parse('2015-01-01'),
          get: () => D.parse('2015-03-01'),
        },
        date: D.parse('2015-03 Z'),
      });
      const expected = {
        price: Utils.roundBy100(price / 31),
        serviceFees: Utils.roundBy100(serviceFees / 31),
      };

      return expect(actual).toEqual(expected);
    });

    test('it bills a single day when booking is the last day of the month', () => {
      const actual = Renting.prorate({
        renting: {
          price,
          serviceFees,
          bookingDate: D.parse('2015-01-31'),
          get,
        },
        date: D.parse('2015-01 Z'),
      });
      const expected = {
        price: Utils.roundBy100(price / 31),
        serviceFees: Utils.roundBy100(serviceFees / 31),
      };

      return expect(actual).toEqual(expected);
    });
  });

  describe('.getPeriod', () => {
    test('it should return the Renting\'s status', () => {
      const date = D.parse('2017-07-07 Z');

      expect(Renting.getPeriod({
        get: () => D.parse('2016-03-03 Z'),
        bookingDate: D.parse('2016-01-01 Z'),
      }, date)).toEqual('past');
      expect(Renting.getPeriod({
        get: () => D.parse('2018-03-03 Z'),
        bookingDate: D.parse('2017-01-01 Z'),
      }, date)).toEqual('current');
      expect(Renting.getPeriod({
        get: () => D.parse('2018-03-03 Z'),
        bookingDate: D.parse('2018-01-01 Z'),
      }, date)).toEqual('future');
    });
  });

  describe('.calculatePriceAndFees', () => {
    test('it should calculate the price and service fees for the renting', () => {
      const room = {
        basePrice: 9500, // rounding-safe price
        Apartment: { roomCount: 3 },
      };
      const bookingDate = D.parse('2017-08-04 Z'); // 100% date
      const hasTwoOccupants = true;

      return Renting
        .calculatePriceAndFees({ room, bookingDate, hasTwoOccupants })
        .then(({ price, serviceFees }) => {
          expect(price).toEqual(18500);
          expect(serviceFees).toEqual(3000);
          return null;
        });
    });
  });

  describe('.updatePackLevel', () => {
    it('should update the label, price and productId of a pack item', () => {
      return fixtures((u) => ({
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `john-${u.int(1)}@doe.something`,
          status: 'draft',
        }],
        District: [{ id: u.id('district') }],
        Apartment: [{ id: u.id('apartment'), DistrictId: u.id('district') }],
        Room: [{ id: u.id('room'), ApartmentId: u.id('apartment') }],
        Renting: [{
          id: u.id('renting'),
          ClientId: u.id('client'),
          RoomId: u.id('room'),
          status: 'draft',
          packLevel: 'basic',
        }],
        Order: [{
          id: u.id('order'),
          ClientId: u.id('client'),
          label: 'Pack order',
          status: 'draft',
        }],
        OrderItem: [{
          id: u.id('packitem'),
          label: 'Basic pack item',
          unitPrice: 12300,
          RentingId: u.id('renting'),
          ProductId: 'basic-pack',
          status: 'draft',
        }],
      }))({ method: 'create', hooks: false })
      .tap(({ instances: { renting, packitem } }) => {
        expect(packitem.unitPrice).toEqual(12300);

        return Renting.updatePackLevel({
          renting,
          packLevel: 'comfort',
          addressCity: 'lyon',
        });
      })
      .then(({ instances: { packitem } }) => packitem.reload())
      .then((packitem) => {
        expect(packitem.label).toMatch(/co[mn]fort/);
        expect(packitem.unitPrice).not.toEqual(12300);
        expect(packitem.ProductId).toEqual('comfort-pack');

        return null;
      });
    });
  });

  describe('hooks', () => {
    describe('afterCreate', () => {
      it('should create quote orders when comfortLevel is present', () => {
        const { createQuoteOrders } = Renting;

        Renting.createQuoteOrders = jest.fn();

        return fixtures((u) => ({
          Client: [{
            id: u.id('client'),
            firstName: 'John',
            lastName: 'Doe',
            email: `john-${u.int(1)}@doe.something`,
            status: 'draft',
          }],
          District: [{ id: u.id('district') }],
          Apartment: [{ id: u.id('apartment'), DistrictId: u.id('district') }],
          Room: [{ id: u.id('room'), ApartmentId: u.id('apartment') }],
          Renting: [{
            id: u.id('renting1'),
            ClientId: u.id('client'),
            RoomId: u.id('room'),
            status: 'draft',
            comfortLevel: 'basic',
          }],
        }))({ method: 'create', hooks: 'Renting' })
        .tap(({ unique: u }) => {
          const call = Renting.createQuoteOrders.mock.calls[0][0];

          expect(call.packLevel).toBe('basic');
          expect(call.discount).toBe(0);
          expect(call.room.id).toBe(u.id('room'));
          expect(call.apartment.id).toBe(u.id('apartment'));

          return Promise.all([
            u,
            Renting.create({
              id: u.id('renting2'),
              ClientId: u.id('client'),
              RoomId: u.id('room'),
              status: 'draft',
              comfortLevel: 'privilege',
              discount: 123,
            }),
          ]);
        })
        .tap(({ unique: u }) => {
          const call = Renting.createQuoteOrders.mock.calls[1][0];

          expect(call.packLevel).toBe('privilege');
          expect(call.discount).toBe(12300);
          expect(call.room.id).toBe(u.id('room'));
          expect(call.apartment.id).toBe(u.id('apartment'));

          Object.assign(Renting, { createQuoteOrders });

          return null;
        });
      });
    });

    describe('afterUpdate', () => {
      it('shouldn\'t do anything unless status is updated to active', () => {
        const mock = jest.fn((res) => res);
        const { handleAfterUpdate } = Renting;

        Renting.handleAfterUpdate = (renting) => mock(handleAfterUpdate(renting, {}));

        return fixtures((u) => ({
          Client: [{
            id: u.id('client'),
            firstName: 'John',
            lastName: 'Doe',
            email: `john-${u.int(1)}@doe.something`,
            status: 'draft',
          }],
          District: [{ id: u.id('district') }],
          Apartment: [{ id: u.id('apartment'), DistrictId: u.id('district') }],
          Room: [{ id: u.id('room'), ApartmentId: u.id('apartment') }],
          Renting: [{
            id: u.id('renting'),
            ClientId: u.id('client'),
            RoomId: u.id('room'),
            status: 'draft',
          }],
        }))({ method: 'create', hooks: 'Renting' })
        .tap(({ instances: { renting } }) => renting.update({ status: 'cancelled' }))
        .then(Promise.delay(200))
        .then(() => expect(mock).toHaveBeenCalledWith(true) )
        .then(() => Renting.handleAfterUpdate = handleAfterUpdate);
      });

      it('should mark the client + related orders active, send email + update WP', () =>
        fixtures((u) => ({
          Client: [{
            id: u.id('client'),
            firstName: 'John',
            lastName: 'Doe',
            email: `john-${u.int(1)}@doe.something`,
            status: 'draft',
          }],
          Order: [{
            id: u.id('draftRentOrder'),
            label: 'A random order',
            ClientId: u.id('client'),
            status: 'draft',
          }, {
            id: u.id('draftDepositOrder'),
            label: 'A random order',
            ClientId: u.id('client'),
            status: 'draft',
          }, {
            id: u.id('draftPackOrder'),
            label: 'A random order',
            ClientId: u.id('client'),
            status: 'draft',
          }, {
            id: u.id('cancelledRentOrder'),
            label: 'A random order',
            ClientId: u.id('client'),
            status: 'cancelled',
          }, {
            id: u.id('unrelatedOrder'),
            label: 'An unrelated order',
            ClientId: u.id('client'),
            status: 'draft',
          }],
          District: [{ id: u.id('district') }],
          Apartment: [{ id: u.id('apartment'), DistrictId: u.id('district') }],
          Room: [{ id: u.id('room'), ApartmentId: u.id('apartment') }],
          Renting: [{
            id: u.id('renting'),
            ClientId: u.id('client'),
            RoomId: u.id('room'),
            status: 'draft',
          }],
          OrderItem: [{
            label: 'A random item',
            OrderId: u.id('draftRentOrder'),
            RentingId: u.id('renting'),
            ProductId: 'rent',
          }, {
            label: 'A random item',
            OrderId: u.id('draftDepositOrder'),
            RentingId: u.id('renting'),
            ProductId: 'montpellier-deposit',
          }, {
            label: 'A random item',
            OrderId: u.id('draftPackOrder'),
            RentingId: u.id('renting'),
            ProductId: 'comfort-pack',
          }, {
            label: 'A random item',
            OrderId: u.id('cancelledRentOrder'),
            RentingId: u.id('renting'),
            ProductId: 'rent',
          }],
        }))({ method: 'create', hooks: 'Renting' })
        .tap(({ instances: { renting } }) => renting.update({ status: 'active' }))
        .tap(Promise.delay(200))
        .then(({ instances }) => {
          const {
            client,
            renting,
            room,
            apartment,
            draftRentOrder,
            draftDepositOrder,
            cancelledRentOrder,
            unrelatedOrder,
          } = instances;
          const sendWelcomeArgs = Sendinblue.sendWelcomeEmail.mock.calls[0][0];
          const updateRoomArgs = Wordpress.makeRoomUnavailable.mock.calls[0][0];

          expect(sendWelcomeArgs.rentOrder.id).toBe(draftRentOrder.id);
          expect(sendWelcomeArgs.depositOrder.id).toBe(draftDepositOrder.id);
          expect(sendWelcomeArgs.client.id).toBe(client.id);
          expect(sendWelcomeArgs.renting.id).toBe(renting.id);
          expect(sendWelcomeArgs.room.id).toBe(room.id);
          expect(sendWelcomeArgs.apartment.id).toBe(apartment.id);
          expect(sendWelcomeArgs.comfortLevel).toEqual('comfort');

          expect(updateRoomArgs.room.id).toBe(room.id);

          return Promise.all([
            expect(client.reload())
              .resolves.toEqual(expect.objectContaining({ status: 'active' })),
            expect(draftRentOrder.reload())
              .resolves.toEqual(expect.objectContaining({ status: 'active' })),
            expect(draftDepositOrder.reload())
              .resolves.toEqual(expect.objectContaining({ status: 'active' })),
            expect(cancelledRentOrder.reload())
              .resolves.toEqual(expect.objectContaining({ status: 'cancelled' })),
            expect(unrelatedOrder.reload())
              .resolves.toEqual(expect.objectContaining({ status: 'draft' })),
          ]);
        })
      );
    });
  });
});
