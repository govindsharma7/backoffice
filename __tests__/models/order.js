const {Client, Order, OrderItem, Payment} = require('../../src/models');

var order;
var client;
var randomNumber1;
var randomNumber2;

describe('Order', () => {
  beforeAll(() => {
    randomNumber1 = Math.round(Math.random() * 1E9);
    randomNumber2 = Math.round(Math.random() * 1E9);

    return Client.findOrCreate({
        where: { id: 0 },
        defaults: {
          id: 0,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@doe.com',
          phoneNumber: '0033612345678',
        },
        hooks: false,
      })
      .then(([_client]) => {
        client = _client;
        if ( !client.invoiceninjaClientId ) {
          return client.createInvoiceninja();
        }
        return client;
      })
      .then((client) => {
        return Order.create({
          type: 'invoice',
          label: 'test order',
          ClientId: client.id,
        }, {hooks: false});
      })
      .then((_order) => {
        order = _order;

        return Promise.all([
          Payment.create({
            type: 'manual',
            amount: 100,
            OrderId: order.id,
          }, {hooks: false}),
          OrderItem.create({
            label: 'test item 1',
            quantity: 3,
            unitPrice: 100,
            OrderId: order.id,
          }, {hooks: false}),
          OrderItem.create({
            label: 'test item 2',
            quantity: 1,
            unitPrice: 200,
            vatRate: 0,
            OrderId: order.id,
          }, {hooks: false}),
        ]);
      });
  });

  describe('#getAmount()', () => {
    test('it should calculate the amount for one item', () => {
      return order.getAmount()
        .then((amount) => {
          expect(amount).toEqual(300 + 200);
        });
    });
  });

  describe('#getTotalPaid()', () => {
    test('it should calculate the amount for one item', () => {
      return order.getTotalPaid()
        .then((totalPaid) => {
          expect(totalPaid).toEqual(100);
        });
    });
  });

  describe('#toInvoiceninjaOrder()', () => {
    test('it should serialize the order for InvoiceNinja', () => {
      return order
        .toInvoiceninjaOrder({
          'invoice_number': '1234',
        })
        .then((obj) => {
          expect(obj).toEqual({
            'client_id': client.invoiceninjaClientId,
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

  describe('#createInvoiceninja()', () => {
    test('it should succeed and set the invoiceninjaInvoiceId prop', () => {
      return order.createInvoiceninja({
          'invoice_number': randomNumber1,
        })
        .then((response) => {
          expect(+response.obj.data.invoice_number).toEqual(randomNumber1);
          expect(typeof order.invoiceninjaInvoiceId).toEqual('number');
        });
    });
  });

  describe('#updateInvoiceninja()', () => {
    test('it should update the invoice', () => {
      return order.updateInvoiceninja({
          'invoice_number': randomNumber2,
        })
        .then((response) => {
          expect(+response.obj.data.invoice_number).toEqual(randomNumber2);
        });
    });
  });
});
