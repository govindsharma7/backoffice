const path    = require('path');
const fs      = require('fs');
const Payline = require('payline');
const config  = require('../../config');

const wsdlPath = path.resolve(__dirname, 'WebPaymentAPI-v4-production.wsdl');

if ( !fs.existsSync(wsdlPath) ) {
  throw new Error('Payline\'s WSDL file not found');
}

const payline = new Payline(
  config.PAYLINE_MERCHANT_ID,
  config.PAYLINE_ACCESS_KEY,
  config.PAYLINE_CONTRACT_NUMBER,
  config.PAYLINE_HOMOLOGATION === true ? undefined : wsdlPath
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
