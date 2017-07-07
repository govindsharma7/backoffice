const Promise  = require('bluebird');
const fixtures = require('../../__fixtures__/order');
const models   = require('../../src/models');

const {Order} = models;
var order;
var invoiceCounter;

describe('Order', () => {
  beforeAll(() => {
    return fixtures()
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
          Order.create({
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

  describe('#ninjaSerialize()', () => {
    test('it should serialize the order for InvoiceNinja', () => {
      return order
        .ninjaSerialize({
          'invoice_number': '1234',
        })
        .then((obj) => {
          return expect(obj).toEqual({
            'client_id': null,
            'invoice_number': '1234',
            'amount': 300 + 200,
            'balance': (100 + 100) - (300 + 200) - 100,
            'invoice_items': [{
              'product_key': 'test item 1',
              'cost': 1,
              'qty': 3,
              'notes': '',
            }, {
              'product_key': 'test item 2',
              'cost': 2,
              'qty': 1,
              'notes': '',
            }],
          });
        });
    });
  });

});
