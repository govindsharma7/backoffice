const Promise               = require('bluebird');
const fixtures              = require('../../../__fixtures__');
const models                = require('../../../src/models');
const Sendinblue            = require('../../../src/vendor/sendinblue');

const { Order, Payment } = models;

describe('Payment - Hooks', () => {
  describe('afterCreate', () => {
    it('should send a payment confirmation after create', () => {
      jest.spyOn(Order, 'pickReceiptNumber');
      jest.spyOn(Order, 'handleAfterUpdate')
        .mockImplementationOnce(() => true);
      jest.spyOn(Payment, 'zapCreated')
        .mockImplementationOnce(() => true);
      jest.spyOn(Sendinblue, 'sendPaymentConfirmation')
        .mockImplementationOnce(() => true);

      return fixtures((u) => ({
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
          status: 'draft',
        }],
        Payment: [{
          id: u.id('payment-0'),
          type: 'card',
          amount: 10000,
          OrderId: u.id('order-0'),
        }],
      }))({ method: 'create', hooks: 'Payment' })
      .tap(() => Promise.delay(200))
      .tap(() => {
        expect(Order.pickReceiptNumber).toHaveBeenCalled();
        expect(Order.handleAfterUpdate).toHaveBeenCalled();
      })
      .tap(({ instances }) => {
        const { client, order, payment } =
          Sendinblue.sendPaymentConfirmation.mock.calls[0][0];

        expect(client.id).toBe(instances['client-0'].id);
        expect(order.id).toBe(instances['order-0'].id);
        expect(payment.amount).toBe(instances['payment-0'].amount);
      })
      .tap(({ instances }) => {
        const { client, order, payment } =
          Payment.zapCreated.mock.calls[0][0];

        expect(client.id).toBe(instances['client-0'].id);
        expect(order.id).toBe(instances['order-0'].id);
        expect(payment.amount).toBe(instances['payment-0'].amount);
      });
    });
  });

  describe('beforeDelete, beforeUpdate', () => {
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
          status: 'active',
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
      }))({ method: 'create', hooks: false })
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
