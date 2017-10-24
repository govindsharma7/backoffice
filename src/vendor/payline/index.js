const path    = require('path');
const fs      = require('fs');
const Payline = require('payline');
const config  = require('../../config');

const wsdlPath = path.resolve(__dirname, 'WebPaymentAPI-v4-production.wsdl');

// Webpack needs a special config to get path.resolve(__dirname, ...) to work
// This test should prevent pushing to prod if that config ever breaks
// (needless to say, if this test throws, removing it isn't the solution!)
if ( !fs.existsSync(wsdlPath) ) {
  throw new Error('Payline\'s WSDL file not found');
}

const payline = new Payline(
  config.PAYLINE_MERCHANT_ID,
  config.PAYLINE_ACCESS_KEY,
  config.PAYLINE_CONTRACT_NUMBER,
  config.NODE_ENV === 'production' ? wsdlPath : undefined
);

payline.pingService = function() {
  return payline
    .getWallet(123456)
    .catch((error) => {
      if ( error.code !== '02532' ) {
        throw error;
      }
      console.error(error);
    });
};

module.exports = payline;
