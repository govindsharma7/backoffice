const {Client, Order} = require('../../src/models');

var client;
var order;

describe('InvoiceNinja integration', () => {
  beforeAll(() => {
    return Promise.all([
      Client.findById('client-1'),
      Order.findById('order-1'),
    ])
    .then(([_client, _order]) => {
      client = _client;
      order = _order;

      return client.ninjaUpsert();
    })
    .then(() => {
      return order.ninjaUpsert();
    });
  });

  // We only test upsert methods because they're the only ones which don't
  // require any preparation of InvoiceNinja.
  describe('Client#ninjaUpsert', () => {
    test('Client is successfully retrieved or created', () => {
      expect(typeof client.ninjaId).toEqual('number');
    });
  });

  describe('Order#ninjaUpsert', () => {
    test('Order is successfully retrieved or created', () => {
      expect(typeof order.ninjaId).toEqual('number');
    });
  });
});
