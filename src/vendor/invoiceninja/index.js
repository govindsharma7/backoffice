const Swagger           = require('swagger-client');
const Deasync           = require('deasync');
const {
  INVOICENINJA_URL,
  INVOICENINJA_API_KEY,
}                       = require('../../config');
const spec              = require('./invoiceninja-spec');

let Ninja;

/* eslint-disable promise/catch-or-return, promise/always-return */
new Swagger({
  spec,
  usePromise: true,
  authorizations: {
    'api_key': new Swagger.ApiKeyAuthorization(
      'X-Ninja-Token',
      INVOICENINJA_API_KEY,
      'header'
    ),
  },
})
// Override the host hardcoded in the spec.
.then((ninja) => {
  Ninja = ninja;
  Ninja.setSchemes([INVOICENINJA_URL.split('://')[0]]);
  Ninja.setHost(INVOICENINJA_URL.split('://')[1]);
  Ninja.INVOICE_STATUS_PAID = 6;
  Ninja.INVOICE_STATUS_PARTIAL = 5;
  Ninja.INVOICE_STATUS_DRAFT = 1;
});

// Swagger client initialization is async :thumbs-down:. Fix that!
/* eslint-disable no-unmodified-loop-condition */
while ( !Ninja ) {
  Deasync.sleep(1);
}

module.exports = Ninja;
