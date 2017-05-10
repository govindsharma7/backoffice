const PACK_PRICES = {
  lyon: {
    basique: 59000,
    confort: 79000,
    privilege: 99000,
  },
  montpellier: {
    basique: 39000,
    confort: 59000,
    privilege: 79000,
  },
  paris: {
    basique: 79000,
    confort: 99000,
    privilege: 119000,
  },
};

module.exports = function(city, level) {
  return PACK_PRICES[city][level];
};
