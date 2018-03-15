jest.mock('../../../src/vendor/wordpress');

const D                   = require('date-fns');
const Promise             = require('bluebird');
const fixtures            = require('../../../__fixtures__');
const Wordpress           = require('../../../src/vendor/wordpress');
const Sendinblue          = require('../../../src/vendor/sendinblue');
const Utils               = require('../../../src/utils');
const models              = require('../../../src/models');

const { Renting, Room } = models;

describe('Renting - Hooks', () => {
  const { handleBeforeValidate } = Renting;
  const spiedSendTemplate = jest.spyOn(Sendinblue, 'sendTemplateEmail');
  const spiedMakeRoomUnavailable = jest.spyOn(Wordpress, 'makeRoomUnavailable');

  describe('beforeValidate', () => {
    it('should\'t allow booking a room while it\'s rented', async () => {
      const { unique: u } = await fixtures((u) => ({
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
      }))();

      const actual = handleBeforeValidate(models.Renting.build({
        ClientId: u.id('client2'),
        RoomId: u.id('room'),
        status: 'active',
        bookingDate: new Date(),
      }));

      return expect(actual).rejects.toThrowErrorMatchingSnapshot();
    });

    it('should allow modifying the bookingDate of a renting', async () => {
      const { unique: u } = await fixtures((u) => ({
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
      }))();

      // We need to reload the renting using findById, otherwise the
      // _changed properties will be eroneous
      const renting = await Renting.findById(u.id('renting'));
      const nextBooking = D.addDays(new Date(), 1);
      const updated = await renting.update({ bookingDate: nextBooking });

      return expect(updated.bookingDate).toEqual(nextBooking);
    });
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
          addressCity: 'lyon',
          roomCount: 3,
        }],
        Room: [{
          id: u.id('room'),
          ApartmentId: u.id('apartment'),
          basePrice: 69000,
        }],
      }))();
      const renting = await Renting.create({
        ClientId: client.id,
        RoomId: room.id,
        packLevel: 'basic',
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
          addressCity: 'lyon',
          roomCount: 3,
        }],
        Room: [{
          id: u.id('room'),
          ApartmentId: u.id('apartment'),
          basePrice: 69000,
        }],
      }))();

      const renting = await Renting.create({
        ClientId: client.id,
        RoomId: room.id,
        packLevel: 'basic',
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
      const { unique: u } = await fixtures((u) => ({
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `${u.id('client')}@test.com`,
          status: 'draft',
        }],
        Apartment: [{
          id: u.id('apartment'),
          name: 'Beautiful place',
          addressCity: 'lyon',
          DistrictId: 'lyon-ainay',
        }],
        Room: [{
          id: u.id('room'),
          ApartmentId: u.id('apartment'),
        }],
      }))();

      await Renting.create({
        id: u.id('renting1'),
        ClientId: u.id('client'),
        RoomId: u.id('room'),
        status: 'draft',
        packLevel: 'privilege',
        price: 24600,
        serviceFees: 3000,
        discount: 234,
        bookingDate: D.parse('2017-02-15T12:00Z'), // 1st day of 2nd 1/2 of month
      });

      const orders1 = await models.Order.findAll({
        include: [{
          model: models.OrderItem,
          required: true,
          where: { RentingId: u.id('renting1') },
        }],
      });

      const packOrder1 = orders1.find(({ OrderItems: [{ ProductId }] }) =>
        ProductId === 'privilege-pack'
      );
      const packItem = packOrder1.OrderItems.find(({ ProductId, unitPrice }) =>
        ProductId === 'privilege-pack' && unitPrice > 0
      );
      const discountItem = packOrder1.OrderItems.find(({ ProductId, unitPrice }) =>
        ProductId === 'privilege-pack' && unitPrice < 0
      );
      const depositOrder1 = orders1.find(({ OrderItems: [{ ProductId }] }) =>
        ProductId === 'lyon-deposit'
      );
      const rentOrder1 = orders1.find(({ OrderItems: [{ ProductId }] }) =>
        ProductId === 'rent'
      );
      const rentItem1 = rentOrder1.OrderItems.find(({ ProductId }) =>
        ProductId === 'rent'
      );
      const serviceItem1 = rentOrder1.OrderItems.find(({ ProductId }) =>
        ProductId === 'service-fees'
      );

      expect(orders1.length).toEqual(3);
      expect(packItem.unitPrice)
        .toEqual(Utils.getPackPrice({
          addressCity: 'lyon',
          packLevel: 'privilege',
        }));
      expect(discountItem.unitPrice).toEqual(-23400);
      expect(depositOrder1.OrderItems[0].unitPrice)
        .toEqual(Utils.getDepositPrice({ addressCity: 'lyon' }));
      expect(serviceItem1.unitPrice).toEqual(1500);
      expect(rentItem1.unitPrice).toEqual(12300);
      expect(Utils.snapshotableLastCall(spiedSendTemplate))
        .toMatchSnapshot();
    });
  });

  describe('afterUpdate', () => {
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
          email: `${u.id('client')}@test.com`,
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
        Apartment: [{
          id: u.id('apartment'),
          name: 'Beautiful place',
          addressCity: 'lyon',
          DistrictId: 'lyon-ainay',
        }],
        Room: [{
          id: u.id('room'),
          ApartmentId: u.id('apartment'),
          reference: `REF-${u.id('room')}-1`,
        }],
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
        draftRentOrder,
        draftDepositOrder,
        cancelledRentOrder,
        unrelatedOrder,
      } = instances;

      await renting.update({ status: 'active' });

      expect(Utils.snapshotableLastCall(spiedSendTemplate))
        .toMatchSnapshot();
      expect(Utils.snapshotableLastCall(spiedMakeRoomUnavailable))
        .toMatchSnapshot();

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
