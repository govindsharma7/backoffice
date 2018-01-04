const roundBy100 = require('./roundBy100');

const Utils = { roundBy100 };

// We want room prices to be rounded down to psychological prices:
// prices between X98 and (X+1)10 are rounded to 98
// and this should also be true when service fees are added
module.exports = function( basePrice, periodCoef, serviceFees ) {
  // The logic is clearer if we convert all prices to euros
  let euroPrice = Math.round( basePrice * periodCoef / 100 );
  const euroFees = serviceFees / 100;
  const priceRemainder = euroPrice % 100;
  const totalPriceRemainder = ( euroPrice + euroFees ) % 100;

  if ( priceRemainder > 98 || priceRemainder < 10 ) {
      euroPrice = Utils.roundBy100( euroPrice ) - 2;
  }
  else if ( totalPriceRemainder > 98 || totalPriceRemainder < 10 ) {
      euroPrice = Utils.roundBy100( euroPrice ) - 2 - euroFees;
  }

  return euroPrice * 100;
};
