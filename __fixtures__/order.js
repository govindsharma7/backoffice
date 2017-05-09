const fixtures = require('./index');

module.exports = fixtures((u) => {
  return {
    Client:[{
      id: u.id('client-1'),
      firstName: 'John',
      lastName: 'Doe',
      email: u.str('john@doe.com'),
      phoneNumber: '0033612345678',
    }],
    Order: [{
      id: u.id('order-1'),
      type: 'debit',
      receiptNumber: u.int(1),
      label: 'test order 1',
      ClientId: u.id('client-1'),
      dueDate: '2016-01-01',
    }],
    OrderItem: [{
      id: u.id('orderitem-1'),
      label: 'test item 1',
      quantity: 3,
      unitPrice: 100,
      vatRate: 0,
      OrderId: u.id('order-1'),
    }, {
      id: u.id('orderitem-2'),
      label: 'test item 2',
      quantity: 1,
      unitPrice: 200,
      vatRate: 0,
      OrderId: u.id('order-1'),
    }],
    Payment: [{
      id: u.id('payment-1'),
      type: 'manual',
      amount: 100,
      OrderId: u.id('order-1'),
    }],
    Credit: [{
      id: u.id('refund-1'),
      amount: 90,
      PaymentId: u.id('payment-1'),
    }],
  };
});
