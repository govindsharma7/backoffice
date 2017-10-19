const Payline = require('payline');
const config  = require('../config');

const payline = new Payline(
  config.PAYLINE_MERCHANT_ID,
  config.PAYLINE_ACCESS_KEY,
  config.PAYLINE_CONTRACT_NUMBER
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
