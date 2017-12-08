const Promise                 = require('bluebird');
const { ROOM_SWITCH_FEES }  = require('../const');

module.exports = function(switchCount, level) {
  if ( switchCount > 0 ) {
    return Promise.resolve(ROOM_SWITCH_FEES.basic);
  }

  return Promise.resolve(ROOM_SWITCH_FEES[level]);
};
