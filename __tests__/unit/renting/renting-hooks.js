const D                   = require('date-fns');
const Promise             = require('bluebird');
const fixtures            = require('../../../__fixtures__');
const Wordpress           = require('../../../src/vendor/wordpress');
const Sendinblue          = require('../../../src/vendor/sendinblue');
const models              = require('../../../src/models');

const { Renting, Room } = models;

describe('Renting - Hooks', () => {
  const { handleBeforeValidate, handleAfterCreate } = Renting;
  const { createQuoteOrders } = Renting;
  const { sendBookingSummaryEmail } = Sendinblue;
  const spiedHandleBeforeValidate =
    jest.spyOn(Renting, 'handleBeforeValidate')
      .mockImplementation(() => true);
  const spiedHandleAfterCreate =
    jest.spyOn(Renting, 'handleAfterCreate')
      .mockImplementation(() => true);

  Renting.createQuoteOrders = jest.fn();
  Sendinblue.sendBookingSummaryEmail = jest.fn();

  afterAll(() => {
    Renting.createQuoteOrders = createQuoteOrders;
    Sendinblue.sendBookingSummaryEmail = sendBookingSummaryEmail;
  });

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
        spiedHandleBeforeValidate.mockImplementationOnce(handleBeforeValidate);

        // We need to reload the renting using findById, otherwise the
        // _changed properties will be eroneous
        const renting = await Renting.findById(instances.renting.id);
        const nextBooking = D.addDays(new Date(), 1);
        const updated = await renting.update({ bookingDate: nextBooking });

        return expect(updated.bookingDate).toEqual(nextBooking);
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
    it('should create quote orders when packLevel is present', () => {
      spiedHandleAfterCreate.mockImplementation(handleAfterCreate);

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
          packLevel: 'basic',
        }],
      }))({ method: 'create', hooks: 'Renting' })
      .tap(({ unique: u }) => {
        const cqoCall = Renting.createQuoteOrders.mock.calls[0][0];
        const sbseCall = Sendinblue.sendBookingSummaryEmail.mock.calls[0][0];

        expect(cqoCall.packLevel).toEqual('basic');
        expect(cqoCall.discount).toEqual(0);
        expect(cqoCall.room.id).toEqual(u.id('room'));
        expect(cqoCall.apartment.id).toEqual(u.id('apartment'));

        expect(sbseCall.client.id).toEqual(u.id('client'));
        expect(sbseCall.renting.id).toEqual(u.id('renting1'));
        expect(sbseCall.apartment.id).toEqual(u.id('apartment'));

        return Renting.create({
          id: u.id('renting2'),
          ClientId: u.id('client'),
          RoomId: u.id('room'),
          status: 'draft',
          packLevel: 'privilege',
          discount: 123,
        });
      })
      .tap(({ unique: u }) => {
        const cqoCall = Renting.createQuoteOrders.mock.calls[1][0];
        const sbseCall = Sendinblue.sendBookingSummaryEmail.mock.calls[1][0];

        expect(cqoCall.packLevel).toEqual('privilege');
        expect(cqoCall.discount).toEqual(12300);
        expect(cqoCall.room.id).toEqual(u.id('room'));
        expect(cqoCall.apartment.id).toEqual(u.id('apartment'));

        expect(sbseCall.client.id).toEqual(u.id('client'));
        expect(sbseCall.renting.id).toEqual(u.id('renting2'));
        expect(sbseCall.apartment.id).toEqual(u.id('apartment'));

        spiedHandleBeforeValidate.mockRestore();

        return null;
      });
    });
  });

  describe('afterUpdate', () => {
    it('shouldn\'t do anything unless status is updated to active', () => {
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
      .then(({ instances: { renting } }) => {
        const actual =
          Renting.handleAfterUpdate(renting.set({ status: 'cancelled' }), {});

        return expect(actual).resolves.toEqual(true);
      });
    });

    it('should mark the client + related orders active, send email + update WP', () => {
      Sendinblue.sendWelcomeEmail = jest.fn();
      Wordpress.makeRoomUnavailable = jest.fn();

      return fixtures((u) => ({
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
        expect(sendWelcomeArgs.packLevel).toEqual('comfort');

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
      });
    });
  });
});
