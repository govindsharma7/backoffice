const { required }    = require('../utils');
const {
  WORDPRESS_AJAX_URL,
  REST_API_SECRET,
  NODE_ENV,
}                     = require('../config');
const fetch           = require('./fetch');

function makeRoomUnavailable({ room = required() }) {
  return NODE_ENV === 'production' && fetch(WORDPRESS_AJAX_URL, {
    method: 'post',
    body: {
      action: 'update_availability',
      privateKey: REST_API_SECRET,
      reference: room.reference,
      metaValue: '20300901',
    },
  });
}

function pingService() {
  return fetch(WORDPRESS_AJAX_URL, {
    method: 'post',
    body: {
      action: 'ping',
      privateKey: REST_API_SECRET,
    },
  });
}

module.exports = {
  makeRoomUnavailable,
  pingService,
};
