const Promise  = require('bluebird');
const fixtures = require('../../__fixtures__/order');
const {Order}  = require('../../src/models');

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
            }, {
              'product_key': 'test item 2',
              'cost': 2,
              'qty': 1,
            }],
          });
        });
    });
  });

});
