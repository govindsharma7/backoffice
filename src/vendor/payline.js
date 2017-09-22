const Payline = require('payline');
const config  = require('../config');

const payline = new Payline(
  config.PAYLINE_MERCHANT_ID,
  config.PAYLINE_ACCESS_KEY,
  config.PAYLINE_CONTRACT_NUMBER
);

module.exports = payline;
