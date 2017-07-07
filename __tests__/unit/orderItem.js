const models = require('../../src/models');

describe('OrderItem', () => {
  const item = models.OrderItem.build({
    label: 'test item',
    quantity: 3,
    unitPrice: 100,
    vatRate: 0.2,
  });

  describe('#ninjaSerialize()', () => {
    test('it should serialize the item for InvoiceNinja', () => {
      return item.ninjaSerialize()
        .then((obj) => {
          return expect(obj).toEqual({
            'product_key': 'test item',
            'cost': 1,
            'qty': 3,
            'notes': '',
          });
        });
    });
  });
});
