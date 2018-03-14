const { DEPOSIT_PRICES }  = require('../const');
const required            = require('./required');

function getDepositPrice({ addressCity = required() }) {
  return DEPOSIT_PRICES[addressCity];
}

module.exports = getDepositPrice;
