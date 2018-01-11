jest.mock('../../../src/vendor/payline');

const Promise       = require('bluebird');
const orderFixtures = require('../../../__fixtures__/order');
const payline       = require('../../../src/vendor/payline');
const models        = require('../../../src/models');


const { Order, Metadata } = models;

let order;
let invoiceCounter;

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
      return Order.scope('totalPaidRefund')
        .findById(order.id)
        .then((order) => {
          expect(order.get('totalPaid')).toEqual(100 + 100);
          return expect(order.get('totalRefund')).toBe(100);
        });
    });
    test('amount scope return amount of an order', () => {
      return Order.scope('amount')
        .findById(order.id)
        .then((order) => expect(order.get('amount')).toEqual(100 * 3 + 200));
    });
  });

  describe('#getAmount()', () => {
    test('it should calculate the amount for one item', () => {
      return order
        .getAmount()
        .then((amount) => expect(amount).toEqual(300 + 200));
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
          Order.create({
            type: 'debit',
            label: 'test numbering',
          }),
        ])
        .then(([counter, order]) => Promise.all([
          counter,
          order.pickReceiptNumber(),
        ]))
        .then(([counter, order]) =>
          expect(order.receiptNumber).toEqual((counter.value + 1).toString())
        );
    });
  });

  describe('.pay', () => {
    const mockedDoPurchase = jest.spyOn(payline, 'doPurchase')
      .mockImplementation(() => ({ transactionId: Math.random() }));
    const mockedCreate = jest.spyOn(Metadata, 'create')
      .mockImplementation(() => Promise.resolve(true));
    const card = { cardNumber: '4242424242424242' };

    afterAll(() => {
      mockedDoPurchase.mockRestore();
      mockedCreate.mockRestore();
    });

    it('should throw if the card type is invalid', () => {
      const actual = Order.pay({
        order: {},
        balance: -100,
        card: { cardNumber: '6666666666666666' },
      });

      return expect(actual).rejects.toThrow(expect.objectContaining({
        code: 'payment.invalidCardType',
      }));
    });

    it('should throw if the order is cancelled', () => {
      const actual = Order.pay({
        order: { status: 'cancelled' },
        balance: -100,
        card,
      });

      return expect(actual).rejects.toThrow(expect.objectContaining({
        code: 'payment.orderCancelled',
      }));
    });

    it('should throw if balance is null or positive', async () => {
      const actualNull = Order.pay({
        order: {},
        balance: 0,
        card,
      });
      const actualPositive = Order.pay({
        order: {},
        balance: 100,
        card,
      });

      await expect(actualNull).rejects.toThrow(expect.objectContaining({
        code: 'payment.orderPaid',
      }));
      await expect(actualPositive).rejects.toThrow(expect.objectContaining({
        code: 'payment.orderPaid',
      }));

      return true;
    });

    it('should save error info as metadata', async () => {
      const id = 123456;
      const shouldThrow = Order.pay({
        order: { id, status: 'cancelled' },
        balance: -100,
        card,
      });

      await expect(shouldThrow).rejects.toThrow();

      return expect(mockedCreate).lastCalledWith(expect.objectContaining({
        name: 'paymentError',
        MetadatableId: id,
      }));
    });
  });
});
