const { required }    = require('../utils');
const {
  ZAPIER_API_URL,
  NODE_ENV,
}                     = require('../config');
const fetch           = require('./fetch');

function postPayment(args) {
  const {
    client = required(),
    payment = required(),
    order = required(),
  } = args;

  return NODE_ENV === 'production' && fetch(ZAPIER_API_URL, {
    method: 'post',
    body: {
      messageType: 'payment',
      client: client.fullName,
      order: order.label,
      amount: payment.amount / 100,
    },
  });
}

function pingService() {
  return fetch(ZAPIER_API_URL);
}

module.exports = {
  postPayment,
  pingService,
};
