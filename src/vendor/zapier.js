const querystring         = require('querystring');
const { required }        = require('../utils');
const { ZAPIER_API_URL }  = require('../config');
const fetch               = require('./fetch');

function postPayment(args) {
  const {
    client = required(),
    payment = required(),
    order = required(),
  } = args;

  return fetch(`${ZAPIER_API_URL}/ssjjcr/`, {
    method: 'post',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: querystring.stringify({
      messageType: 'payment',
      client: client.fullName,
      order: order.label,
      amount: payment.amount / 100,
    }),
  });
}

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

module.exports = {
  postPayment,
  postRentInvoiceSuccess,
  pingService,
};
