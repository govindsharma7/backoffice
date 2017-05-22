const uuid     = require('uuid/v4');
const {Client} = require('../../src/models');
const fixtures = require('../../__fixtures__/client');

var client;

describe('Payline integration', () => {
  beforeAll(() => {
    return fixtures()
      .then(({instances}) => {
        return client = instances['client-1'];
      });
  });

  describe('Client.paylineCredit', () => {
    test('it should creat an order with negative amount', () => {
      const values = {
        cardNumber: '4111111111111111',
        cardType: 'Visa',
        expirationMonth: '12',
        expirationYear: '2020',
        cvv: '123',
        holder: 'Toto Tata',
        amount: '100',
        orderLabel: 'test credit',
        reason: 'credit client',
      };
      const idCredit = uuid();

      return Client.paylineCredit(client.id, values, idCredit)
        .then((order) => {
          expect(order).toBeDefined();
          expect(order.Credits).toBeDefined();
          expect(order.OrderItems).toBeDefined();
          expect(order.OrderItems[0].unitPrice).toBe(-10000);
          return true;
        });
    });
  });
});
