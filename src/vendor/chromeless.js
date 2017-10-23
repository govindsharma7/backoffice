const { Chromeless } = require('chromeless');
const {
  NODE_ENV,
  CHROMELESS_ENDPOINT,
  CHROMELESS_SESSION_KEY,
  WEBSITE_URL,
}                 = require('../config');

function connect() {
  return new Chromeless( NODE_ENV === 'development' ? undefined : {
    remote: {
      endpointUrl: CHROMELESS_ENDPOINT,
      apiKey: CHROMELESS_SESSION_KEY,
    },
  });
}

function invoiceAsPdf(orderId, lang) {
  const chromeless = connect();

  return chromeless
    .goto(`${WEBSITE_URL}/${lang}/invoice/${orderId}`)
    .wait('div.invoice-content')
    .pdf()
    .then((pdf) => {
      chromeless.end();

      return pdf;
    });
}

function pingService() {
  return connect()
    .goto('https://www.google.com')
    .await('body')
    .end();
}

module.exports = {
  invoiceAsPdf,
  pingService,
};
