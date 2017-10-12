#!/usr/bin/env node

const Promise               = require('bluebird');
const D                     = require('date-fns');
const _                     = require('lodash');
const models                = require('../src/models');
const SendinBlue            = require('../src/vendor/sendinblue');
const {
  SENDINBLUE_TEMPLATE_IDS,
  PAYMENT_URL,
}                           =  require('../src/config');


const {Client} = models;
const month = D.addMonths(Date.now(), 1);

return Client.scope(
  { method: ['rentOrdersFor', month] },
  'uncashedDepositCount',
  'paymentMetadata')
  .findAll()
  // Filter-out clients who already have an order for this month
  .then((clients) => {
    return clients.filter((client) => {
      return client.Orders.length === 0;
    });
  })
  .then((clients) => {
    return Promise.map(clients, (client) => {
      return Promise.all([
        client,
        client.getRentingsFor(month),
      ]);
    });
  })
  // Filter-out clients with no active rentings
  .then((tuples) => {
    return tuples.filter(([{firstName, lastName}, rentings]) => {
      const fullName = _.padEnd(`${firstName}  ${lastName}`, 35);

      console.log(`${fullName} has ${rentings.length} rentings`);
      return rentings.length > 0;
    });
  })
  .tap((tuples) => {
    // rentings-orders should be created one after the other, otherwise they all
    // pick the same receiptNumber
    return Promise.reduce(tuples, (prev, [client, rentings]) => {
      console.log(
        `>>>>>>>>> Generating rent-order for ${client.firstName} ${client.lastName}`
      );
      rentings.forEach((renting) => {
        console.log(`>>>>>>>>>>> ${renting.Room.name}`);
      });

      return client
        .findOrCreateRentOrder(rentings, month)
        .tap(([order]) => {
          return order.pickReceiptNumber();
        })
        .tap(([order]) => {
          return order.ninjaCreate();
        })
        .then(([order]) => {
          return Promise.all([
            models.Order.scope('amount').findById(order.id),
            order.id,
          ]);
        })
        .then(([order, id]) => {
          const lang = client.preferredLanguage === 'en' ? 'en-US' : 'fr-FR';

          return SendinBlue.sendEmail(
            SENDINBLUE_TEMPLATE_IDS.rentInvoice,
            {
              emailTo: [client.email],
              attributes: {
                NAME: `${client.firstName} ${client.lastName}`,
                AMOUNT: order.get('amount') / 100,
                LINK: `${PAYMENT_URL}/${lang}/payment/${id}`,
              },
          });
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
    console.log(`${tuples.length} RENT ORDERS GENERATED!`);
    return process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    throw err;
  });
