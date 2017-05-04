const {OrderItem} = require('../../src/models');

describe('OrderItem', () => {
  const item = OrderItem.build({
    label: 'test item',
    quantity: 3,
    unitPrice: 100,
    vatRate: 0.2,
  });

  describe('#getAmount()', () => {
    test('it should calculate the amount for one item', () => {
      return item.getAmount()
        .then((amount) => {
          return expect(amount).toEqual(360);
        });
    });
  });

  describe('#ninjaSerialize()', () => {
    test('it should serialize the item for InvoiceNinja', () => {
      return item.ninjaSerialize()
        .then((obj) => {
          return expect(obj).toEqual({
            'product_key': 'test item',
            'cost': 100,
            'qty': 3,
          });
        });
    });
  });
});
