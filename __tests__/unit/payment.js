jest.mock('../../src/vendor/sendinblue');
jest.mock('../../src/utils');

const Promise               = require('bluebird');
const fixtures              = require('../../__fixtures__');
const models                = require('../../src/models');
const Sendinblue            = require('../../src/vendor/sendinblue');
const Utils                 = require('../../src/utils');

const { Order } = models;

describe('Payment', () => {
  describe('hooks', () => {
    beforeAll(() => {
      Utils.getInvoiceLink = jest.fn(() => 'https://domain.com');
      Sendinblue.sendPaymentConfirmation = jest.fn(() =>
        Promise.resolve({ messageId: '123456' })
      );
      Order.pickReceiptNumber = jest.fn((order) => order);
    });

    it('should send a payment confirmation on payment:afterCreate', () =>
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
        }],
        Payment: [{
          id: u.id('payment-0'),
          type: 'card',
          amount: 10000,
          OrderId: u.id('order-0'),
        }],
      }))({ method: 'create', hooks: true })
      .tap(() => Promise.delay(1000))
      .then(({ instances }) => {
        const { client, order, amount } =
          Sendinblue.sendPaymentConfirmation.mock.calls[0][0];

        expect(Order.pickReceiptNumber).toHaveBeenCalled();
        expect(client.id).toBe(instances['client-0'].id);
        expect(order.id).toBe(instances['order-0'].id);
        expect(amount).toBe(instances['payment-0'].amount);

        return null;
      })
    );

    it('should prevent non-manual payments to be updated or deleted', () =>
      fixtures((u) => ({
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `john-${u.int(1)}@doe.something`,
        }],
        Order: [{
          id: u.id('order'),
          label: 'A random order',
          ClientId: u.id('client'),
        }],
        Payment: [{
          id: u.id('cardPayment'),
          type: 'card',
          amount: 10000,
          OrderId: u.id('order'),
        }, {
          id: u.id('manualPayment'),
          type: 'manual',
          amount: 10000,
          OrderId: u.id('order'),
        }],
      }))({ method: 'create', hooks: 'Payment' })
      .tap(({ instances: { cardPayment, manualPayment } }) => Promise.all([
        expect(cardPayment.update({ amount: 20000 }))
          .rejects.toBeInstanceOf(Error),
        expect(manualPayment.update({ amount: 20000 }))
          .resolves.toEqual(expect.objectContaining({ amount: 20000 })),
      ]))
      .tap(({ instances: { cardPayment, manualPayment } }) => Promise.all([
        expect(cardPayment.destroy())
          .rejects.toBeInstanceOf(Error),
        expect(manualPayment.destroy())
          .resolves.toEqual(expect.anything()),
      ]))
    );
  });
});
