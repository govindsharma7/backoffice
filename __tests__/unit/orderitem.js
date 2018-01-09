const Promise               = require('bluebird');
const fixtures              = require('../../__fixtures__');

describe('OrderItem', () => {
  describe('hooks', () => {
    it('should prevent any alteration of items of an order w/ a receipt #', () =>
      fixtures((u) => ({
        Client: [{
          id: u.id('client-0'),
          firstName: 'John',
          lastName: 'Doe',
          email: `john-${u.int(0)}@doe.something`,
        }],
        Order: [{
          id: u.id('order-0'),
          label: 'A random order',
          ClientId: u.id('client-0'),
          receiptNumber: u.str('receipt-0'),
        }],
        OrderItem: [{
          id: u.id('item-0'),
          label: 'An item',
          OrderId: u.id('order-0'),
        }],
      }))()
      .then(({ instances }) =>
        Promise.all([
          instances['item-0'].destroy(),
          instances['item-0'].update({ label: 'different label' }),
          instances['order-0'].createOrderItem({ label: 'another item' }),
        ].map((operation) => expect(operation).rejects.toBeInstanceOf(Error)))
      )
    );
  });
});
