#!/usr/bin/env node
require('../src/models').Client.createAndSendRentInvoices()
  .then((rentOrders) => {
    console.log(`${rentOrders.length} rent invoices sent!`);
    return process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    throw err;
  });
