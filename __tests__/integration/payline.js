const uuid     = require('uuid/v4');
const {Client} = require('../../src/models');
const fixtures = require('../../__fixtures__');

describe('Payline integration', () => {
  describe('Client.paylineCredit', () => {
    test('it should creat an order with negative amount', async () => {
      const { unique: u } = await fixtures((u) => ({
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `${u.id('client')}@test.com`,
        }],
      }))();

      const values = {
        cardNumber: '4111111111111111',
        cardType: 'Visa',
        expirationMonth: '12',
        expirationYear: '2020',
        cvv: '123',
        holder: 'Toto Tata',
        amount: 100,
        orderLabel: 'test credit',
        reason: 'credit client',
      };
      const idCredit = uuid();

      return Client.paylineCredit(u.id('client'), values, idCredit)
        .then((order) => {
          expect(order).toBeDefined();
          expect(order.Credits).toBeDefined();
          expect(order.OrderItems).toBeDefined();
          expect(order.OrderItems[0].unitPrice).toBe(-100);
          return true;
        });
    });
  });
});
