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

  return fetch(ZAPIER_API_URL, {
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

function postRentReminder(emailCount) {
  return fetch(ZAPIER_API_URL, {
    method: 'post',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: querystring.stringify({
      messageType: 'rentReminder',
      count: emailCount,
    }),
  });
}

function pingService() {
  return fetch(ZAPIER_API_URL);
}

module.exports = {
  postPayment,
  postRentReminder,
  pingService,
};
