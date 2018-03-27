const Promise               = require('bluebird');
const D                     = require('date-fns');
const fixtures              = require('../../__fixtures__');
const models                = require('../../src/models');

const { OrderItem } = models;

describe('OrderItem', () => {
  describe('hooks', () => {
    it('should prevent any alteration of items of an order w/ a receipt #', async () => {
      const { instances: { item, order } } = await fixtures((u) => ({
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `${u.id('client')}@test.com`,
        }],
        Order: [{
          id: u.id('order'),
          label: 'A random order',
          ClientId: u.id('client'),
          receiptNumber: `receipt-${u.id('order')}`,
        }],
        OrderItem: [{
          id: u.id('item'),
          label: 'An item',
          OrderId: u.id('order'),
        }],
      }))();

      return Promise.all([
        item.destroy(),
        OrderItem
          .findById(item.id)
          .then((item) => item.update({ label: 'different label' })),
        order.createOrderItem({ label: 'another item' }),
      ].map((operation) => expect(operation).rejects.toBeInstanceOf(Error)));
    });

    it('should allow updating the foreign keys of an item w/ a receipt #', async () => {
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
          email: `${u.id('client')}@test.com`,
        }],
        Renting: [{
          id: u.id('renting1'),
          bookingDate: D.parse('2016-01-01 Z'),
          ClientId: u.id('client'),
          RoomId: u.id('room'),
        }, {
          id: u.id('renting2'),
          bookingDate: D.parse('2016-01-01 Z'),
          ClientId: u.id('client'),
          RoomId: u.id('room'),
        }],
        Order: [{
          id: u.id('order'),
          label: 'A random order',
          ClientId: u.id('client'),
          receiptNumber: `receipt-${u.id('order')}`,
        }],
        OrderItem: [{
          id: u.id('item'),
          label: 'An item',
          OrderId: u.id('order'),
          ProductId: 'basic-pack',
          RentingId: u.id('renting1'),
        }],
      }))();

      const wontUpdate =
        OrderItem
          .findById(u.id('item'))
          .then((item) => item.update({
            ProductId: 'comfort-pack',
            RentingId: u.id('renting2'),
            quantity: 2,
          }));
      const willUpdate =
        OrderItem
          .findById(u.id('item'))
          .then((item) => item.update({
            ProductId: 'comfort-pack',
            RentingId: u.id('renting2'),
          }));

      await expect(wontUpdate).rejects.toBeInstanceOf(Error);
      await expect(willUpdate).resolves.toEqual(expect.anything());
    });
  });
});
