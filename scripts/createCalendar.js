#!/usr/bin/env node

const Promise   = require('bluebird');
const Calendar  = require('googleapis').calendar('v3');
const jwtClient = require('../src/vendor/googlecalendar');

const calendarsInsert = Promise.promisify(Calendar.calendars.insert);
const aclInsert = Promise.promisify(Calendar.acl.insert);

return Promise.map([
  'Lyon',
  'Montpellier',
  'Paris',
  'refund_deposit',
], (city) => {
  return calendarsInsert({
      auth: jwtClient,
      resource: {
        summary: city === 'refund_deposit' ?
        'Refund Deposit' : `Checkin/Checkout ${city}`,
      },
    })
    .tap((calendar) => {
      return aclInsert({
        auth: jwtClient,
        calendarId: calendar.id,
        resource: {
          role: 'writer',
          scope: {
            type: 'domain',
            value: 'chez-nestor.com',
          },
        },
      });
    })
    .then((calendar) => {
      return console.log(`${city}: ${calendar.id}`);
    });
});
