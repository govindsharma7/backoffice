const Promise             = require('bluebird');
const {ROOM_SWITCH_PRICES} =  require('../const');

module.exports = function(count, level) {
  var price;

  if ( count > 0 ) {
    return Promise.resolve(ROOM_SWITCH_PRICES.basic);
  }
  switch ( level ) {
    case 'basic' :
      price = ROOM_SWITCH_PRICES.basic;
      break;
    case 'comfort' :
      price = ROOM_SWITCH_PRICES.comfort;
      break;
    case 'privilege' :
      price = ROOM_SWITCH_PRICES.privilege;
      break;
    default:
      price = ROOM_SWITCH_PRICES.basic;
  }
  return Promise.resolve(price);
};
