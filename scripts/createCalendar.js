const calendar = require('googleapis').calendar('v3');

const jwtClient = require('../src/vendor/googlecalendar');

calendar.calendars.insert({
  auth: jwtClient,
  resource: {
    summary: 'checkin-checkout',
  },
}, (err, Calendar) => {
  calendar.acl.insert({
    auth: jwtClient,
    calendarId: Calendar.id,
    resource: {
      role: 'reader',
      scope: {
        type: 'domain',
        value: 'chez-nestor.com',
      },
    },
  }, () => {
    console.log(Calendar.id);
  });
});
