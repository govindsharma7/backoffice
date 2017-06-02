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
    }, {
      id: u.id('order-2'),
      type: 'debit',
      receiptNumber: u.int(1),
      label: 'test order 2',
      ClientId: u.id('client-1'),
      dueDate: '2017-04-31',
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
    }, {
      id: u.id('orderitem-3'),
      label: 'test item 3',
      quantity: 1,
      unitPrice: 628,
      vatRate: 0,
      OrderId: u.id('order-2'),
      ProductId: 'rent',
    }],
    Payment: [{
      id: u.id('payment-1'),
      type: 'manual',
      amount: 100,
      paylineId: u.str('1'),
      OrderId: u.id('order-1'),
    }],
    Credit: [{
      id: u.id('credit-1'),
      amount: 100,
<<<<<<< b0237890647ce9730c5241e52a8e70e77a5f031a
      paylineId: u.str('1'),
=======
      paylineId: u.str('2'),
>>>>>>> Order.calculateLateFees
      PaymentId: u.id('payment-1'),
    }, {
      id: u.id('credit-2'),
      status: 'draft',
      amount: 100,
<<<<<<< b0237890647ce9730c5241e52a8e70e77a5f031a
      paylineId: u.str('2'),
=======
      paylineId: u.str('3'),
>>>>>>> Order.calculateLateFees
      deletedAt: '2015-02-10',
      PaymentId: u.id('payment-1'),
    }],
  };
});
