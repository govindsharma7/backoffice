#!/usr/bin/env node
const Promise    = require('bluebird');
const D          = require('date-fns');
const models     = require('../src/models');
const Sendinblue = require('../src/vendor/sendinblue');

const { Order } = models;
const now = new Date();

return Order.scope('rentOrders')
  .findAll({
    where: {
      $or: [
        { dueDate: now },
        { dueDate: D.addDays(now, 3) },
        { dueDate: D.addDays(now, 5) },
      ],
    },
    include: [{
      model: models.Client,
      where: { status: 'active' },
    }],
  })
  .map((order) => {
    return Promise.all([
      order,
      order.getCalculatedProps(),
    ]);
  })
  .filter(([, { balance }]) => { return balance < 0; })
  .map(([order, { amount }]) => {
    return Sendinblue
      .sendRentReminder({ order, client: order.Client, amount })
      .then(({ messageId }) => {
        return order.createMetadatum({
          name: 'messageId',
          value: messageId,
        });
      });
  });
