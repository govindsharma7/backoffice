#!/usr/bin/env node
const Promise    = require('bluebird');
const D          = require('date-fns');
const fr         = require('date-fns/locale/fr');
const models     = require('../src/models');
const SendinBlue = require('../src/vendor/sendinblue');
const {
  SENDINBLUE_TEMPLATE_IDS,
  WEBSITE_URL,
}                = require('../src/config');

const { Client } = models;

return Client
  .findAll()
  .map((client) => {
    return client.applyLateFees()
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
        .then(([{amount}, orderItems]) => {
          const lang = client.preferredLanguage === 'en' ? 'en-US' : 'fr-FR';

          return SendinBlue.sendEmail(
            SENDINBLUE_TEMPLATE_IDS.lateFees[client.preferredLanguage],
            {
              emailTo: [client.email],
              attributes: {
                FIRSTNAME: client.firstName,
                MONTH: client.preferredLanguage === 'en' ?
                D.format(order.dueDate, 'MMMM') :
                D.format(order.dueDate, 'MMMM', {locale: fr}),
                AMOUNT: amount / 100,
                LATE_FEES: orderItems[0].unitPrice * orderItems[0].quantity / 100,
                LINK: `${WEBSITE_URL}/${lang}/payment/${order.id}`,
              },
          });
        });
    });
  })
  .then(() => {
    return process.exit(0);
  })
  .catch((e) => {
    console.error(e);
  });
