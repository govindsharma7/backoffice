const app                   = require('express')();
const fixtures              = require('../../../__fixtures__');
const models                = require('../../../src/models');

const { Payment, Order, Room } = models;

describe('Payment routes', () => {
  // Initialize methods in route file
  Payment.routes(app, models);

  describe('.handleCreatePaymentRoute', () => {
    const spiedOrderFind = jest.spyOn(Order, 'findById');
    const spiedOrderPay = jest.spyOn(Order, 'pay');
    const spiedRoomScope = jest.spyOn(Room, 'scope');
    const spiedRoomAvailability = jest.spyOn(Room, 'getEarliestAvailability');

    // Be a gentleman and cleanup after yourself
    afterAll(() => {
      [
        spiedOrderFind,
        spiedOrderPay,
        spiedRoomScope,
        spiedRoomAvailability,

      ].forEach((spied) => spied.mockRestore());
    });

    it('should throw if the order isn\'t found', () => {
      spiedOrderFind.mockImplementationOnce(() => false);

      const actual =
        Payment.handleCreatePaymentRoute({ body: { orderId: 'testOrderId' } });

      return expect(actual).rejects.toThrowErrorMatchingSnapshot();
    });

    it('should throw if the room is no longer available', () => {
      spiedOrderFind.mockImplementationOnce(() => ({
        OrderItems: [{
          ProductId: 'basic-pack',
          Renting: { RoomId: 'testRoomId' },
        }],
      }));
      spiedRoomScope.mockImplementationOnce(() => ({ findById: () => ({
        Rentings: {},
      }) }));
      spiedRoomAvailability.mockImplementationOnce(() => false);

      const actual =
        Payment.handleCreatePaymentRoute({ body: {} });

      return expect(actual).rejects.toThrowErrorMatchingSnapshot();
    });

    it('should throw if the order balance does\'t match the request one', () => {
      spiedOrderFind.mockImplementationOnce(() => ({
        OrderItems: [],
        getCalculatedProps: () => ({ balance: -456 }),
      }));

      const actual =
        Payment.handleCreatePaymentRoute({ body: { balance: -123 } });

      return expect(actual).rejects.toThrowErrorMatchingSnapshot();
    });

    it('should call Order.pay if no error is detected', async () => {
      const { instances: { order } } = await fixtures((u) => ({
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `john-${u.int(1)}@doe.something`,
          status: 'active',
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
      }))({ method: 'create', hooks: false });

      spiedOrderPay.mockImplementationOnce(() => ({ transactionId: 'greatSuccess' }));

      await Payment.handleCreatePaymentRoute(
        { body: {
          orderId: order.id,
          balance: -123,
          cardNumber: 'a',
          holderName: 'b',
          expiryMonth: 'c',
          expiryYear: 'd',
          cvv: 'e',
        } },
        { send: (res) => res }
      );

      const expectedArg = {
        balance: -123,
        card: {
          cardNumber: 'a',
          holderName: 'b',
          expiryMonth: 'c',
          expiryYear: 'd',
          cvv: 'e',
        },
      };

      return expect(spiedOrderPay)
        .lastCalledWith( expect.objectContaining(expectedArg) );
    });
  });
});
