const Promise          = require('bluebird');
const {DEPOSIT_PRICES} = require('../const');

module.exports = function(addressCity) {
  return Promise.resolve(DEPOSIT_PRICES[addressCity]);
};
