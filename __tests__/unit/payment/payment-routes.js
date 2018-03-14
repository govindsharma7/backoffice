jest.mock('../../../src/vendor/zapier');

const app                   = require('express')();
const fixtures              = require('../../../__fixtures__');
const models                = require('../../../src/models');
const Payline               = require('../../../src/vendor/payline');

const { Payment } = models;

describe('Payment - Routes', () => {
  // Initialize methods in route file
  Payment.routes(app, models);

  describe('.handleCreatePaymentRoute', () => {

    it('should throw if the order isn\'t found', async () => {
      await fixtures(() => ({}))();

      const actual = Payment.handleCreatePaymentRoute({
        body: { orderId: 'inexistantOrderId' },
      });

      return expect(actual).rejects.toThrowErrorMatchingSnapshot();
    });

    it('should throw if the room is no longer available', async () => {
      const { unique: u } = await fixtures((u) => ({
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `john-${u.int(0)}@doe.something`,
          status: 'active',
        }],
        Apartment: [{ id: u.id('apartment'), DistrictId: 'lyon-ainay' }],
        Room: [{ id: u.id('room'), ApartmentId: u.id('apartment') }],
        Renting: [{
          id: u.id('renting'),
          ClientId: u.id('client'),
          RoomId: u.id('room'),
          status: 'active',
          bookingDate: new Date(0),
        }],
        Order: [{
          id: u.id('order'),
          label: 'label',
          ClientId: u.id('client'),
        }],
        OrderItems: [{
          OrderId: u.id('order'),
          ProductId: 'basic-pack',
          RentingId: u.id('renting'),
        }],
      }))();

      const actual =
        Payment.handleCreatePaymentRoute({ body: { orderId: u.id('order') } });

      return expect(actual).rejects.toThrowErrorMatchingSnapshot();
    });

    it('should throw if the order balance does\'t match the request one', async () => {
      const { unique: u } = await fixtures((u) => ({
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `john-${u.int(0)}@doe.something`,
          status: 'active',
        }],
        Order: [{
          id: u.id('order'),
          label: 'label',
          ClientId: u.id('client'),
        }],
        OrderItems: [{
          OrderId: u.id('order'),
          ProductId: 'rent',
          unitPrice: 45600,
        }],
      }))();

      const actual = Payment.handleCreatePaymentRoute({ body: {
        orderId: u.id('order'),
        balance: -123,
      } });

      return expect(actual).rejects.toThrowErrorMatchingSnapshot();
    });

    it('should call Order.pay if no error is detected', async () => {
      const spiedDoPurchase = jest.spyOn(Payline, 'doPurchase');

      const { instances: { order } } = await fixtures((u) => ({
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `john-${u.int(1)}@doe.something`,
          status: 'active',
        }],
        Apartment: [{ id: u.id('apartment'), DistrictId: 'lyon-ainay' }],
        Room: [{ id: u.id('room'), ApartmentId: u.id('apartment') }],
        Renting: [{
          id: u.id('renting'),
          ClientId: u.id('client'),
          RoomId: u.id('room'),
          status: 'draft',
        }],
        Order: [{
          id: u.id('order'),
          label: 'A random order',
          ClientId: u.id('client'),
          status: 'active',
        }],
        OrderItem: [{
          id: u.id('item'),
          label: 'A random order',
          OrderId: u.id('order'),
          ProductId: 'basic-pack',
          RentingId: u.id('renting'),
          status: 'active',
          unitPrice: 123,
        }],
      }))();

      await Payment.handleCreatePaymentRoute(
        { body: {
          orderId: order.id,
          balance: -123,
          cardNumber: '4242424242424242',
          holderName: 'ME',
          expiryMonth: '12',
          expiryYear: '99',
          cvv: 'e',
        } },
        { send: (res) => res }
      );

      expect(spiedDoPurchase).toHaveBeenCalledWith(
        expect.stringContaining(order.id),
        expect.objectContaining({
          number: '4242424242424242',
          type: 'visa',
          holder: 'ME',
          expirationDate: '1299',
          cvx: 'e',
        }),
        123
      );
    });
  });
});
