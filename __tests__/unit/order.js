const Promise       = require('bluebird');
const fixtures      = require('../../__fixtures__');
const orderFixtures = require('../../__fixtures__/order');
const models        = require('../../src/models');

var order;
var invoiceCounter;

describe('Order', () => {
  beforeAll(() => {
    return orderFixtures()
      .then(({instances}) => {
        return (
          order = instances['order-1'],
          invoiceCounter = instances['invoice-counter']
        );
      });
  });

  describe('Scopes', () => {
    test('totalPaidRefund scope return total paid and refund for an Order', () => {
      return models.Order.scope('totalPaidRefund')
        .findById(order.id)
        .then((order) => {
          expect(order.get('totalPaid')).toEqual(100 + 100);
          return expect(order.get('totalRefund')).toBe(100);
        });
    });
    test('amount scope return amount of an order', () => {
      return models.Order.scope('amount')
        .findById(order.id)
        .then((order) => {
          return expect(order.get('amount')).toEqual(100 * 3 + 200);
      });
    });
  });

  describe('#getAmount()', () => {
    test('it should calculate the amount for one item', () => {
      return order
        .getAmount()
        .then((amount) => {
          return expect(amount).toEqual(300 + 200);
        });
    });
  });

  describe('#getTotalPaidAndRefund', () => {
    test('it should calculate the totalpaid and refund for one item', () => {
      return order
        .getTotalPaidAndRefund()
        .then(({totalPaid, totalRefund}) => {
          expect(totalPaid).toEqual(100 + 100);
          return expect(totalRefund).toEqual(100);
        });
    });
  });

  describe('#getCalculatedProps()', () => {
    test('it should calculate amount totalPaid and balance properties', () => {
      return order
        .getCalculatedProps()
        .then((result) => {
          return expect(result).toEqual({
            amount: 500,
            totalPaid: 200,
            totalRefund: 100,
            balance: -400,
          });
        });
    });
  });

  describe('#pickReceiptNumber', () => {
    test('it should set the order number automatically according to its type', () => {
      return Promise.all([
          invoiceCounter
            .set('value', Math.round(Math.random() * 1E12))
            .save(),
          models.Order.create({
            type: 'debit',
            label: 'test numbering',
          }),
        ])
        .then(([counter, order]) => {
          return Promise.all([
            counter,
            order.pickReceiptNumber(),
          ]);
        })
        .then(([counter, order]) => {
          return expect(order.receiptNumber).toEqual((counter.value + 1).toString());
        });
    });
  });

  describe('hooks', () => {
    const { handleAfterUpdate } = models.Renting;

    beforeAll(() => {
      models.Renting.handleAfterUpdate = jest.fn(() => true);
    });
    afterAll(() => {
      models.Renting.handleAfterUpdate = handleAfterUpdate;
    });

    it('should make the items, client and renting active when it becomes active', () =>
      fixtures((u) => ({
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `john-${u.int(1)}@doe.something`,
          status: 'draft',
        }],
        Order: [{
          id: u.id('order'),
          label: 'A random order',
          ClientId: u.id('client'),
          status: 'draft',
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
        OrderItem: [{
          id: u.id('item'),
          label: 'A random order',
          OrderId: u.id('order'),
          RentingId: u.id('renting'),
          status: 'draft',
        }],
      }))({ method: 'create', hooks: 'Order' })
      .tap(({ instances: { order } }) => order.update({ status: 'active' }))
      .tap(Promise.delay(200))
      .then(({ instances: { item, client, renting } }) => Promise.all([
        expect(models.Renting.handleAfterUpdate).toHaveBeenCalled(),
        expect(item.reload())
          .resolves.toEqual(expect.objectContaining({ status: 'active' })),
        expect(client.reload())
          .resolves.toEqual(expect.objectContaining({ status: 'active' })),
        expect(renting.reload())
          .resolves.toEqual(expect.objectContaining({ status: 'active' })),
      ]))
    );
  });
});
