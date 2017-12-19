const { PACK_PRICES } = require('../const');

module.exports = function({ renting, addressCity, packLevel }) {
  return {
    label: `Housing Pack ${addressCity} ${packLevel}`,
    unitPrice: PACK_PRICES[addressCity][packLevel],
    RentingId: renting.id,
    status: renting.status,
    ProductId: `${packLevel}-pack`,
  };
};
