#!/usr/bin/env node

const Promise               = require('bluebird');
const D                     = require('date-fns');
const _                     = require('lodash');
const models                = require('../src/models');
const Sendinblue            = require('../src/vendor/sendinblue');

const {Client} = models;
const month = D.addMonths(Date.now(), 1);

return Client.scope(
    { method: ['rentOrdersFor', month] },
    'uncashedDepositCount'
  )
  .findAll({ where: { status: 'active'}})
  // Filter-out clients who already have an order for this month
  .then((clients) => clients.filter((client) => client.Orders.length === 0))
  .then((clients) => Promise.map(clients, (client) =>
    Promise.all([
      client,
      client.getRentingsFor(month),
    ]))
  )
  // Filter-out clients with no active rentings
  .then((tuples) => tuples.filter(([{firstName, lastName}, rentings]) => {
    const fullName = _.padEnd(`${firstName}  ${lastName}`, 35);

    console.log(`${fullName} has ${rentings.length} rentings`);
    return rentings.length > 0;
  }))
  .mapSeries(([client, rentings]) => {
    console.log(
      `>>>>>>>>> Generating rent-order for ${client.firstName} ${client.lastName}`
    );
    rentings.forEach((renting) => {
      console.log(`>>>>>>>>>>> ${renting.Room.name}`);
    });

    return client
      .findOrCreateRentOrder(rentings, month)
      .then(([order]) => models.Order.scope('amount').findById(order.id))
      .then((order) =>
        Sendinblue.sendRentRequest({ order, client, amount: order.get('amount') })
      )
      .catch((err) => {
        console.log(err);
        console.log(client);
        console.log(rentings);
        throw err;
      });
  })
  .then((rentOrders) => {
    console.log(`${rentOrders.length} RENT ORDERS GENERATED!`);
    return process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    throw err;
  });
