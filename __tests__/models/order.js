const {Client, Order, OrderItem} = require('../../src/models');

var order;
var client;

describe('Order', () => {
  beforeAll(() => {
    return Client.findOrCreate({
        where: { id: 0 },
        defaults: {
          id: 0,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@doe.com',
          phoneNumber: '0033612345678',
        },
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
        });
      })
      .then((_order) => {
        order = _order;

        return Promise.all([
          OrderItem.create({
            label: 'test item 1',
            quantity: 3,
            unitPrice: 100,
            vatRate: 0.2,
            OrderId: order.id,
          }),
          OrderItem.create({
            label: 'test item 2',
            quantity: 1,
            unitPrice: 200,
            vatRate: 0,
            OrderId: order.id,
          }),
        ]);
      });
  });

  describe('#getAmount()', () => {
    test('it should calculate the amount for one item', () => {
      return order.getAmount()
        .then((amount) => {
          expect(amount).toEqual(360 + 200);
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
            'amount': 360 + 200,
            'balance': -(360 + 200),
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
      return order.createInvoiceninja(client)
        .then((_order) => {
          expect(typeof _order.invoiceninjaInvoiceId).toEqual('number');
        });
    });
  });
});
