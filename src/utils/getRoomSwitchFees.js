const Promise = require('bluebird');
const {LEASE} =  require('../const');

module.exports = function(switchCount, level, version) {
  const roomSwitchFees = LEASE[version].ROOM_SWITCH_FEES;

  if ( switchCount > 0 ) {
    return Promise.resolve(roomSwitchFees.basic);
  }

  return Promise.resolve(roomSwitchFees[level]);
};
