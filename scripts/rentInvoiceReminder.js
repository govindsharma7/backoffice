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
      // dueDate: '2017-11-01',
    },
    include: [{
      model: models.Client,
      where: { status: 'active' },
    }],
  })
  .map((order) => Promise.all([
    order,
    order.getCalculatedProps(),
  ]))
  .filter(([, { balance }]) => balance < 0)
  // .filter((val, key) => key > 1)
  .map(([order, { amount }]) =>
    Sendinblue.sendRentReminder({ order, client: order.Client, amount })
  )
  .then((all) => console.log(`${all.length} rent reminders sent.`));
