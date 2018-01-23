const querystring         = require('querystring');
const D                   = require('date-fns');
const { required }        = require('../utils');
const { ZAPIER_API_URL }  = require('../config');
const fetch               = require('./fetch');

function postPayment(args) {
  const {
    client = required(),
    payment = required(),
    order = required(),
    room = {},
    apartment = {},
  } = args;

  return fetch(`${ZAPIER_API_URL}/ssjjcr/`, {
    method: 'post',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: querystring.stringify({
      messageType: 'payment',
      client: client.fullName,
      order: order.label,
      amount: payment.amount / 100,
      date: D.format(payment.createdAt, 'DD/MM/YYYY'),
      time: D.format(payment.createdAt, 'HH:mm'),
      room: room.name,
      city: apartment.addressCity,
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
