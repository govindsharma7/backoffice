#!/usr/bin/env node
// const D = require('date-fns');

require('../src/models').Client
  .createAndSendRentInvoices(/*D.parse('2018-04-01 Z')*/)
  .then((rentOrders) => {
    console.log(`${rentOrders.length} rent invoices sent!`);
    return process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    throw err;
  });
