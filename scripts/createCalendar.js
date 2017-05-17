const calendar = require('googleapis').calendar('v3');

const jwtClient = require('../src/vendor/googlecalendar');

calendar.calendars.insert({
  auth: jwtClient,
  resource: {
    summary: 'Checkin/Checkout Lyon',
  },
}, (err, Calendar) => {
  calendar.acl.insert({
    auth: jwtClient,
    calendarId: Calendar.id,
    resource: {
      role: 'writer',
      scope: {
        type: 'domain',
        value: 'chez-nestor.com',
      },
    },
  }, () => {
    console.log('Lyon:', Calendar.id);
  });
});

calendar.calendars.insert({
  auth: jwtClient,
  resource: {
    summary: 'Checkin/Checkout Montpellier',
  },
}, (err, Calendar) => {
  calendar.acl.insert({
    auth: jwtClient,
    calendarId: Calendar.id,
    resource: {
      role: 'writer',
      scope: {
        type: 'domain',
        value: 'chez-nestor.com',
      },
    },
  }, () => {
    console.log('Montpellier:', Calendar.id);
  });
});

calendar.calendars.insert({
  auth: jwtClient,
  resource: {
    summary: 'Checkin/Checkout Paris',
    timeZone: 'Europe/Paris',
  },
}, (err, Calendar) => {
  calendar.acl.insert({
    auth: jwtClient,
    calendarId: Calendar.id,
    resource: {
      role: 'writer',
      scope: {
        type: 'domain',
        value: 'chez-nestor.com',
      },
    },
  }, () => {
    console.log('Paris:', Calendar.id);
  });
});
