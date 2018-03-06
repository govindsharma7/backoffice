#!/usr/bin/env node

const Promise    = require('bluebird');
const models     = require('../src/models');
const Sendinblue = require('../src/vendor/sendinblue');

const { Client } = models;
let lateOrderCount = 0;

updateAllLateFees()
  .then(() => {
    console.log(`${lateOrderCount} orders detected`);

    return process.exit(0);
  })
  .catch((e) => console.error(e));

async function updateAllLateFees() {
  const clients = await Client.findAll({ where: { status: 'active' } });

  return Promise.map(clients, updateClientLateFees, { concurrency: 3 });
}

function updateClientLateFees(client) {
  return client
    .applyLateFees()
    .map(async (order) => {
      lateOrderCount++;

      const [{amount}, orderItems] = await Promise.all([
        order.getCalculatedProps(),
        models.OrderItem.findAll({
          where: {
            OrderId: order.id,
            ProductId: 'late-fees',
          },
        }),
      ]);

      return Sendinblue.sendLateFeesEmail({ order, amount, orderItems, client });
    });
}
