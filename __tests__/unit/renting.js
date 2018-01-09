jest.mock('../../src/vendor/sendinblue');
jest.mock('../../src/vendor/wordpress');

const D                   = require('date-fns');
const Promise             = require('bluebird');
const fixtures            = require('../../__fixtures__');
const rentingFixtures     = require('../../__fixtures__/renting');
const Wordpress           = require('../../src/vendor/wordpress');
const Sendinblue          = require('../../src/vendor/sendinblue');
const models              = require('../../src/models');

const { Renting, Room } = models;
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

  describe('.updateDraftRentings', () => {
    const now = D.parse('2016-07-23');

    it('should\'t allow booking a room while it\'s rented', () =>
      fixtures((u) => ({
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `john-${u.int(1)}@doe.something`,
        }],
        District: [{ id: u.id('district') }],
        Apartment: [{
          id: u.id('apartment'),
          DistrictId: u.id('district'),
        }],
        Room: [{
          id: u.id('room'),
          ApartmentId: u.id('apartment'),
          basePrice: 65400,
        }],
        Renting: [{
          id: u.id('renting'),
          ClientId: u.id('client'),
          RoomId: u.id('room'),
          status: 'draft',
          bookingDate: D.parse('2016-07-13'),
          price: 56,
          serviceFees: 3000,
        }],
        Order: [{
          id: u.id('order'),
          ClientId: u.id('client'),
          status: 'draft',
        }],
        OrderItem: [{
          id: u.id('rentItem'),
          label: 'yo',
          OrderId: u.id('order'),
          RentingId: u.id('renting'),
          ProductId: 'rent',
          status: 'draft',
          unitPrice: 12,
        }, {
          id: u.id('feesItem'),
          label: 'yo',
          OrderId: u.id('order'),
          RentingId: u.id('renting'),
          ProductId: 'service-fees',
          status: 'draft',
          unitPrice: 34,
        }],
      }))({ method: 'create', hooks: false })
      .then(() => Renting.updateDraftRentings(now))
      .then(([[renting, rentItem, feesItem]]) => {
        expect(renting.bookingDate).toEqual(now);
        expect(renting.price).not.toEqual(56);
        expect(renting.serviceFees).toEqual(3000);
        expect(rentItem.unitPrice).not.toEqual(12);
        expect(feesItem.unitPrice).not.toEqual(34);

        return true;
      })
    );
  });

  describe('hooks', () => {
    const { handleBeforeValidate } = Renting;

    Renting.handleBeforeValidate = jest.fn(() => true);

    describe('beforeValidate', () => {
      it('should\'t allow booking a room while it\'s rented', () =>
        fixtures((u) => ({
          Client: [{
            id: u.id('client1'),
            firstName: 'John',
            lastName: 'Doe',
            email: `john-${u.int(1)}@doe.something`,
          }, {
            id: u.id('client2'),
            firstName: 'Jane',
            lastName: 'Dwight',
            email: `jane-${u.int(1)}@dwight.her`,
          }],
          District: [{ id: u.id('district') }],
          Apartment: [{
            id: u.id('apartment'),
            DistrictId: u.id('district'),
          }],
          Room: [{
            id: u.id('room'),
            ApartmentId: u.id('apartment'),
          }],
          Renting: [{
            id: u.id('currentRenting'),
            ClientId: u.id('client1'),
            RoomId: u.id('room'),
            status: 'active',
            bookingDate: new Date(),
          }],
        }))({ method: 'create', hooks: false })
        .then(({ unique: u }) => {
          const actual = handleBeforeValidate(models.Renting.build({
            ClientId: u.id('client2'),
            RoomId: u.id('room'),
            status: 'active',
            bookingDate: new Date(),
          }));

          expect(actual).rejects.toThrow();

          return true;
        })
      );

      it('should allow modifying the bookingDate of a renting', () =>
        fixtures((u) => ({
          Client: [{
            id: u.id('client1'),
            firstName: 'John',
            lastName: 'Doe',
            email: `john-${u.int(1)}@doe.something`,
          }, {
            id: u.id('client2'),
            firstName: 'Jane',
            lastName: 'Dwight',
            email: `jane-${u.int(1)}@dwight.her`,
          }],
          District: [{ id: u.id('district') }],
          Apartment: [{
            id: u.id('apartment'),
            DistrictId: u.id('district'),
          }],
          Room: [{
            id: u.id('room'),
            ApartmentId: u.id('apartment'),
          }],
          Renting: [{
            id: u.id('renting'),
            ClientId: u.id('client1'),
            RoomId: u.id('room'),
            status: 'active',
            bookingDate: new Date(),
          }],
        }))({ method: 'create', hooks: false })
        .then(async ({ instances }) => {
          Renting.handleBeforeValidate = handleBeforeValidate;

          // We need to reload the renting using findById, otherwise the
          // _changed properties will be eroneous
          const renting = await Renting.findById(instances.renting.id);
          const nextBooking = D.addDays(new Date(), 1);
          const updated = await renting.update({ bookingDate: nextBooking });

          expect(updated.bookingDate).toEqual(nextBooking);

          Renting.handleBeforeValidate = jest.fn(() => true);

          return true;
        })
      );
    });

    describe('beforeCreate', () => {
      it('should calculate renting price and fees when they\'re both 0', () =>
        fixtures((u) => ({
          Client: [{
            id: u.id('client'),
            firstName: 'John',
            lastName: 'Doe',
            email: `john-${u.int(1)}@doe.something`,
            status: 'draft',
          }],
          District: [{ id: u.id('district') }],
          Apartment: [{
            id: u.id('apartment'),
            DistrictId: u.id('district'),
            roomCount: 3,
          }],
          Room: [{
            id: u.id('room'),
            ApartmentId: u.id('apartment'),
            basePrice: 69000,
          }],
          Renting: [{
            id: u.id('renting'),
            ClientId: u.id('client'),
            RoomId: u.id('room'),
          }],
        }))({ method: 'create', hooks: 'Renting' })
        .then(({ instances: { renting, room, apartment } }) => (Promise.all([
          renting,
          Room.getCalculatedProps(room.basePrice, apartment.roomCount),
        ])))
        .then(([renting, { periodPrice, serviceFees }]) => {
          expect(renting.price).toEqual(periodPrice);
          expect(renting.serviceFees).toEqual(serviceFees);

          return true;
        })
      );
    });

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

          Renting.createQuoteOrders = createQuoteOrders;

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
        .then(() => Promise.delay(200))
        .then(() => {
          expect(mock).toHaveBeenCalledWith(true);

          Renting.handleAfterUpdate = handleAfterUpdate;

          return true;
        });
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
