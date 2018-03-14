const getPackPrice = require('./getPackPrice');

module.exports = function({ renting, addressCity, packLevel, order }) {
  const item = {
    label: `Housing Pack ${addressCity} ${packLevel}`,
    unitPrice: getPackPrice({ addressCity, packLevel }),
    RentingId: renting.id,
    status: renting.status,
    ProductId: packLevel.replace(/(-pack)?$/, '$1-pack'),
  };

  if ( order ) {
    item.OrderId = order.id;
  }

  return item;
};
