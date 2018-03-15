const querystring     = require('querystring');
const { required }    = require('../utils');
const {
  WORDPRESS_AJAX_URL,
  REST_API_SECRET,
}                     = require('../config');
const fetch           = require('./fetch');

function makeRoomUnavailable({ reference = required() }) {
  return fetch(WORDPRESS_AJAX_URL, {
    method: 'post',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: querystring.stringify({
      action: 'update_availability',
      privateKey: REST_API_SECRET,
      reference,
      metaValue: '20300901',
    }),
  });
}

function pingService() {
  return fetch(WORDPRESS_AJAX_URL, {
    method: 'post',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: querystring.stringify({
      action: 'ping',
      privateKey: REST_API_SECRET,
    }),
  });
}

module.exports = {
  makeRoomUnavailable,
  pingService,
};
