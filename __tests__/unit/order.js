const fixtures = require('../../__fixtures__/order');
const {Order, Setting} = require('../../src/models');

var order;

describe('Order', () => {
  beforeAll(() => {
    return fixtures()
      .then(({instances}) => {
        order = instances['order-1'];
      });
  });

  describe('#getAmount()', () => {
    test('it should calculate the amount for one item', () => {
      return order
        .getAmount()
        .then((amount) => {
          expect(amount).toEqual(300 + 200);
        });
    });
  });

  describe('#getTotalPaid()', () => {
    test('it should calculate the amount for one item', () => {
      return order
        .getTotalPaid()
        .then((totalPaid) => {
          expect(totalPaid).toEqual(100);
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
          expect(obj).toEqual({
            'client_id': null,
            'invoice_number': '1234',
            'amount': 300 + 200,
            'balance': 100 - (300 + 200),
            'invoice_items': [{
              'product_key': 'test item 1',
              'cost': 1,
              'qty': 3,
            },{
              'product_key': 'test item 2',
              'cost': 2,
              'qty': 1,
            }],
          });
        });
    });
  });

  describe('auto-numbering', () => {
    test('it should set the order number automatically according to its type', () => {
      Setting.findById('invoice-counter')
        .then((counter) => {
          return Order
            .create({
              type: 'invoice',
              label: 'test numbering',
            })
            .then((order) => {
              expect(order.number).toEqual(counter.value.toString());
            });
        });
    });
  });
});
