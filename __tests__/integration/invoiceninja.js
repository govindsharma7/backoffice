const fixtures = require('../../__fixtures__/order');

var client;
var order;

describe('InvoiceNinja integration', () => {
  beforeAll(() => {
    return fixtures()
      .then(({instances}) => {
        order = instances['order-1'];
        client = instances['client-1'];

        return client.ninjaUpsert();
      })
      .then(() => {
        return order.ninjaUpsert();
      })
      .then(() => {
        return Promise.all([
          client.reload(),
          order.reload(),
        ]);
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
