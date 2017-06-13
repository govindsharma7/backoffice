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
], (city) => {
  return calendarsInsert({
      auth: jwtClient,
      resource: {
        summary: `Checkin/Checkout ${city}`,
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
