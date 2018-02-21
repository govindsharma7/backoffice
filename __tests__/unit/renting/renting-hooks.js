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
          status: 'active',
          ClientId: u.id('client1'),
          RoomId: u.id('room'),
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
          status: 'active',
          ClientId: u.id('client1'),
          RoomId: u.id('room'),
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
    it('should calculate renting price and fees when they\'re both 0', async () => {
      const bookingDate = new Date();
      const { instances: { room, apartment, client } } = await fixtures((u) => ({
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
      }))({ method: 'create', hooks: false });
      const renting = await Renting.create({
        ClientId: client.id,
        RoomId: room.id,
        bookingDate,
      });
      const { price, serviceFees } =
        await Room.getPriceAndFees({ room, apartment, date: bookingDate });

      expect(renting.price).toEqual(price);
      expect(renting.serviceFees).toEqual(serviceFees);
    });

    it('should add a fee for two occupants', async () => {
      const bookingDate = new Date();
      const { instances: { room, apartment, client } } = await fixtures((u) => ({
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
      }))({ method: 'create', hooks: false });

      const renting = await Renting.create({
        ClientId: client.id,
        RoomId: room.id,
        bookingDate,
        hasTwoOccupants: true,
      });
      const { price, serviceFees } =
        await Room.getPriceAndFees({ room, apartment, date: bookingDate });

      expect(renting.price).toEqual(price + 9000);
      expect(renting.serviceFees).toEqual(serviceFees);
    });
  });

  describe('afterCreate', () => {
    it('should create quote orders when packLevel is present', async () => {
      spiedHandleAfterCreate.mockImplementation(handleAfterCreate);

      const { unique: u } = await fixtures((u) => ({
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `john-${u.int(1)}@doe.something`,
          status: 'draft',
        }],
        Apartment: [{
          id: u.id('apartment'),
          DistrictId: 'lyon-ainay',
        }],
        Room: [{
          id: u.id('room'),
          ApartmentId: u.id('apartment'),
        }],
      }))({ method: 'create', hooks: false });

      const renting1 = await Renting.create({
        id: u.id('renting1'),
        ClientId: u.id('client'),
        RoomId: u.id('room'),
        status: 'draft',
        packLevel: 'basic',
        price: 12300,
      });
      const cqoCall0 = Renting.createQuoteOrders.mock.calls[0][0];
      const sbseCall0 = Sendinblue.sendBookingSummaryEmail.mock.calls[0][0];

      expect(cqoCall0.packLevel).toEqual('basic');
      expect(cqoCall0.discount).toEqual(0);
      expect(cqoCall0.room.id).toEqual(u.id('room'));
      expect(cqoCall0.apartment.id).toEqual(u.id('apartment'));

      expect(sbseCall0.renting.id).toEqual(renting1.id);
      expect(sbseCall0.client.id).toEqual(u.id('client'));
      expect(sbseCall0.apartment.id).toEqual(u.id('apartment'));

      const renting2 = await Renting.create({
        id: u.id('renting2'),
        ClientId: u.id('client'),
        RoomId: u.id('room'),
        status: 'draft',
        packLevel: 'privilege',
        discount: 123,
        price: 12300,
      });

      const cqoCall1 = Renting.createQuoteOrders.mock.calls[1][0];
      const sbseCall1 = Sendinblue.sendBookingSummaryEmail.mock.calls[1][0];

      expect(cqoCall1.packLevel).toEqual('privilege');
      expect(cqoCall1.discount).toEqual(12300);
      expect(cqoCall1.room.id).toEqual(u.id('room'));
      expect(cqoCall1.apartment.id).toEqual(u.id('apartment'));

      expect(sbseCall1.renting.id).toEqual(renting2.id);
      expect(sbseCall1.client.id).toEqual(u.id('client'));
      expect(sbseCall1.apartment.id).toEqual(u.id('apartment'));

      spiedHandleBeforeValidate.mockRestore();
    });
  });

  describe('afterUpdate', () => {
    jest.spyOn(Sendinblue, 'sendWelcomeEmail').mockImplementation(() => true);
    jest.spyOn(Wordpress, 'makeRoomUnavailable').mockImplementation(() => true);

    it('shouldn\'t do anything unless status is updated to active', async () => {
      const { instances: { renting } } = await fixtures((u) => ({
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
      }))({ method: 'create', hooks: false });

      const actual =
          Renting.handleAfterUpdate(renting.set({ status: 'cancelled' }), {});

      expect(actual).resolves.toEqual(true);
    });

    it('should mark the client + orders active, send email + update WP', async () => {
      const { instances } = await fixtures((u) => ({
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
        Apartment: [{ id: u.id('apartment'), DistrictId: 'lyon-ainay' }],
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
      }))();
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

      await renting.update({ status: 'active' });
      await Promise.delay(200);

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

    // This happens with room-switches
    it('shouldn\'t throw when the renting has no order', async () => {
      const { instances: { renting } } = await fixtures((u) => ({
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `john-${u.int(1)}@doe.something`,
          status: 'draft',
        }],
        Apartment: [{ id: u.id('apartment'), DistrictId: 'lyon-ainay' }],
        Room: [{ id: u.id('room'), ApartmentId: u.id('apartment') }],
        Renting: [{
          id: u.id('renting'),
          ClientId: u.id('client'),
          RoomId: u.id('room'),
          status: 'draft',
        }],
      }))();

      expect(() => renting.update({ status: 'active' })).not.toThrow();
    });
  });
});
