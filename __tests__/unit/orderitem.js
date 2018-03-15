const Promise               = require('bluebird');
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
  });
});
