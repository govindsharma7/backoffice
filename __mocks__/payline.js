const Promise = require('bluebird');

module.exports = function Payline() {
  this.doPurchase = () =>
    Promise.resolve({ transactionId: Math.round(Math.random() * 1E9) });
  this.doCredit = () => Promise.resolve(true);
};
module.exports.CURRENCIES = { EUR: 1 };
