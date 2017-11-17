const { required }    = require('../utils');
const {
  WORDPRESS_AJAX_URL,
  REST_API_SECRET,
}                     = require('../config');
const fetch           = require('./fetch');

function updateRoomAvailability({ room = required() }) {
  return fetch(WORDPRESS_AJAX_URL, {
    method: 'post',
    body: {
      action: 'update_availability',
      privateKey: REST_API_SECRET,
      reference: room.reference,
      meta: '20300901',
    },
  });
}

module.export = {
  updateRoomAvailability,
};
