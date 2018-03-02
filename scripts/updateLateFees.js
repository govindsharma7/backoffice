#!/usr/bin/env node
const Promise    = require('bluebird');
const models     = require('../src/models');
const Sendinblue = require('../src/vendor/sendinblue');

const { Client } = models;

return Client
  .findAll()
  .map((client) =>
    client
      .applyLateFees()
      .map((order) => {
        return Promise.all([
          order.getCalculatedProps(),
          models.OrderItem.findAll({
            where: {
              OrderId: order.id,
              ProductId: 'late-fees',
            },
          }),
        ])
        .then(([{amount}, orderItems]) =>
          Sendinblue.sendLateFeesEmail({ order, amount, orderItems, client })
        );
      })
  )
  .then(() => {
    return process.exit(0);
  })
  .catch((e) => {
    console.error(e);
  });
