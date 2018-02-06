const querystring         = require('querystring');
const { required }        = require('../utils');
const { ZAPIER_API_URL }  = require('../config');
const fetch               = require('./fetch');

function postRentInvoiceSuccess({ type, count }) {
  return fetch(`${ZAPIER_API_URL}/85f0oz/`, {
    method: 'post',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: querystring.stringify({
      messageType: type,
      count,
    }),
  });
}

function pingService() {
  return fetch(ZAPIER_API_URL);
}

function poster(zapId = required()) {
  return function(body) {
    return fetch(`${ZAPIER_API_URL}/${zapId}/`, {
      method: 'post',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: querystring.stringify(body),
    });
  };
}

module.exports = {
  poster,
  postRentInvoiceSuccess,
  pingService,
};
