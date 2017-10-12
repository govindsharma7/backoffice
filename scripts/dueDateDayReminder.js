#!/usr/bin/env node
const Promise    = require('bluebird');
const D          = require('date-fns');
const fr         = require('date-fns/locale/fr');
const models     = require('../src/models');
const SendinBlue = require('../src/vendor/sendinblue');
const {
  SENDINBLUE_TEMPLATE_IDS,
  PAYMENT_URL,
}                = require('../src/config');

const { Order } = models;

return Order.scope('rentOrders')
  .findAll({
    where: {
        'dueDate': new Date(),
    },
  })
  .filter((order) => {
  console.log(order);
    return order.getCalculatedProps()
      .then(({balance}) => {
      return balance < 0;
    });
  })
  .map((order) => {
    return Promise.all([
      order.getClient(),
      order.getCalculatedProps(),
      ])
      .then(([client, {amount}]) => {
        const lang = client.preferredLanguage === 'en' ? 'en-US' : 'fr-FR';

        return SendinBlue.sendEmail(
          SENDINBLUE_TEMPLATE_IDS.dueDate[client.preferredLanguage],
          {
            emailTo: [client.email],
            attributes: {
              FIRSTNAME: client.firstName,
              MONTH: client.preferredLanguage === 'en' ?
                D.format(order.dueDate, 'MMMM') :
                D.format(order.dueDate, 'MMMM', {locale: fr}),
              AMOUNT: amount / 100,
              LINK: `${PAYMENT_URL}/${lang}/payment/${order.id}`,
            },
        });
      });
  })
  .then(() => {
    return process.exit(0);
  })
  .catch((e) => {
    console.error(e);
  });
