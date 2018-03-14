const querystring         = require('querystring');
const { required }        = require('../utils');
const {
  ZAPIER_API_URL,
  NODE_ENV,
}                         = require('../config');
const fetch               = require('./fetch');

function postRentInvoiceSuccess({ type, count }) {
  return fetch(`${ZAPIER_API_URL}/85f0oz/`, {
    method: 'post',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: querystring.stringify({
      messageType: type,
      count,
      environment: NODE_ENV,
    }),
  });
}

function pingService() {
  return fetch(ZAPIER_API_URL);
}

function post(zapId = required(), _body = required()) {
  // querystring.stringify would strip `Date`s from body without this trick
  const body = JSON.parse(JSON.stringify(_body));

  body.environment = NODE_ENV;

  return fetch(`${ZAPIER_API_URL}/${zapId}/`, {
    method: 'post',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: querystring.stringify(body),
  });
}

module.exports = {
  post,
  postRentInvoiceSuccess,
  pingService,
};
