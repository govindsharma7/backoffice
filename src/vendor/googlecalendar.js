const gapis = require('googleapis');
const config = require('../config');

const scopes = ['https://www.googleapis.com/auth/calendar'];


var jwtClient = new gapis.auth.JWT(
  config.GOOGLE_CLIENT_EMAIL,
  null,
  config.GOOGLE_PRIVATE_KEY,
  scopes,
  null
);

jwtClient.authorize(function(err) {
  if (err) {
    console.error(err);
  }
});

module.exports = jwtClient;
