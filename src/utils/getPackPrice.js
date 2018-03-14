const { PACK_PRICES } = require('../const');
const required        = require('./required');

function getPackPrice({ addressCity = required(), packLevel = required() }) {
  return PACK_PRICES[addressCity][packLevel];
}

module.exports = getPackPrice;
