const { Chromeless } = require('chromeless');
const {
  NODE_ENV,
  CHROMELESS_ENDPOINT,
  CHROMELESS_SESSION_KEY,
  WEBSITE_URL,
}                 = require('../config');

const chromeless = new Chromeless( NODE_ENV === 'development' ? undefined : {
  remote: {
    endpointUrl: CHROMELESS_ENDPOINT,
    apiKey: CHROMELESS_SESSION_KEY,
  },
});

function invoiceAsPdf(orderId, lang) {
  return chromeless
    .goto(`${WEBSITE_URL}/${lang}/invoice/${orderId}`)
    .wait('div.invoice-content')
    .pdf();
}

module.exports = {
  invoiceAsPdf,
};
