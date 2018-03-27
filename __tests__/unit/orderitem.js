const Promise               = require('bluebird');
const D                     = require('date-fns');
const fixtures              = require('../../__fixtures__');

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
        item.update({ label: 'different label' }),
        order.createOrderItem({ label: 'another item' }),
      ].map((operation) => expect(operation).rejects.toBeInstanceOf(Error)));
    });

    it('should allow updating the foreign keys of an item w/ a receipt #', async () => {
      const { instances: { item }, unique: u } = await fixtures((u) => ({
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
        }],
        OrderItem: [{
          id: u.id('item'),
          label: 'An item',
          OrderId: u.id('order'),
          ProductId: 'basic-pack',
          RentingId: u.id('renting1'),
        }],
      }))();

      const wontUpdate = item.update({
        ProductId: 'comfort-pack',
        RentingId: u.id('renting2'),
        quantity: 2,
      });

      const willUpdate = item.update({
        ProductId: 'comfort-pack',
        RentingId: u.id('renting2'),
      });

      expect(wontUpdate).rejects.toBeInstanceOf(Error);
      expect(willUpdate).resolves.not.toThrow();
    });
  });
});
