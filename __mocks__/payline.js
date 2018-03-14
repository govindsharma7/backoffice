const Promise = require('bluebird');

module.exports = function Payline() {
  this.doPurchase = () =>
    Promise.resolve({ transactionId: Math.round(Math.random() * 1E9) });
};
