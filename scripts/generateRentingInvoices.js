#!/usr/bin/env node

const Promise = require('bluebird');
const D       = require('date-fns');
const models  = require('../src/models');

const {Client, Order} = models;
const month = D.addMonths(Date.now(), 1);

Client.findAll()
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
      ]);
    });
  })
  // Filter-out clients with no active rentings
  .then((tuples) => {
    return Promise.filter(tuples, ({rentings}) => {
      return rentings.length > 0;
    });
  })
  .then((tuples) => {
    return Promise.map(tuples, ({client, rentings}) => {
      return client.createRentingsOrder(rentings, month);
    });
  })
  .then((orders) => {
    return Order.generateInvoices(orders);
  })
  .then(() => {
    return console.log('ALL ORDERS GENERATED!');
  })
  .catch((err) => {
    console.error(err);
    throw err;
  });
