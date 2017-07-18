#!/usr/bin/env node
const Ninja   = require('../src/vendor/invoiceninja');
const models = require('../src/models');

const {Order, Client} = models;

return Order.scope('rentOrders')
  .findAll({
    where: {dueDate: {$lt: Date.now()}},
    include: [{model: Client}],
  })
  .map((order) => {
    return Ninja.invoice.getInvoice({
      'invoice_id': order.ninjaId,
    })
    .then((response) => {
      const {data} = response.obj;

      if ( data.invoice_status_id === Ninja.INVOICE_STATUS_PAID ) {
        throw new Error('this invoice has been paid');
      }
      return order.Client.applyLateFees();
    });
  });
