const Swagger   = require('swagger-client');
const Deasync   = require('deasync');
const config    = require('../../config');
const spec      = require('./invoiceninja-spec');

let Ninja;

new Swagger({
  spec,
  usePromise: true,
  authorizations: {
    'api_key': new Swagger.ApiKeyAuthorization(
      'X-Ninja-Token',
      config.INVOICENINJA_API_KEY,
      'header'
    ),
  },
})
// Override the host hardcoded in the spec.
.then((ninja) => {
  Ninja = ninja;
  Ninja.setSchemes([config.NODE_ENV === 'development' ? 'http' : 'https']);
  Ninja.setHost(config.INVOICENINJA_HOST);
});

// Swagger client initialization is async :thumbs-down:. Fix that!
/* eslint-disable no-unmodified-loop-condition */
while( !Ninja ) {
  Deasync.sleep(1);
}

module.exports = Ninja;
