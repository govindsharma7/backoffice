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
          expect(amount).toEqual(360);
        });
    });
  });

  describe('#toInvoiceninjaItem()', () => {
    test('it should serialize the item for InvoiceNinja', () => {
      return item.toInvoiceninjaItem()
        .then((obj) => {
          expect(obj).toEqual({
            'product_key': 'test item',
            'cost': 100 / 100,
            'qty': 3,
          });
        });
    });
  });
});
