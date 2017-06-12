#!/usr/bin/env node

const Promise = require('bluebird');
const D       = require('date-fns');
const models  = require('../src/models');

const {Client} = models;
const month = D.addMonths(Date.now(), 1);

return Client.findAll()
  .then((clients) => {
    return Promise.map(clients, (client) => {
      return Promise.all([
        client,
        client.getRentingOrdersFor(month),
      ]);
    });
  })
  // Filter-out clients who already have an order for this month
  .then((tuples) => {
    return Promise.filter(tuples, ([, orders]) => {
      return orders.length === 0;
    });
  })
  .then((tuples) => {
    return Promise.map(tuples, ([client]) => {
      return Promise.all([
        client,
        client.getRentingsFor(month),
        client.hasUncashedDeposit(),
      ]);
    });
  })
  // Filter-out clients with no active rentings
  .then((tuples) => {
    return Promise.filter(tuples, ([client, rentings]) => {
      console.log(`${client.id} has ${rentings.length} rentings`);
      return rentings.length > 0;
    });
  })
  .tap((tuples) => {
    // rentings-orders should be created one after the other, otherwise they all
    // pick the same receiptNumber
    return Promise.reduce(tuples, (prev, [client, rentings, hasUncashedDeposit]) => {
      return client
        .createRentingsOrder(rentings, hasUncashedDeposit, month)
        .tap((order) => {
          return order.pickReceiptNumber();
        })
        .then((order) => {
          return order.ninjaCreate();
        })
        .catch((err) => {
          console.log(err);
          console.log(client);
          console.log(rentings);
          throw err;
        });
    }, false);
  })
  .then((tuples) => {
    return console.log(`${tuples.length} RENT ORDERS GENERATED!`);
  })
  .catch((err) => {
    console.error(err);
    throw err;
  });
