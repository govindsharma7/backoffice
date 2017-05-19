const euroRound       = require('./euroRound');
const {
  getCheckinPrice,
  getCheckoutPrice,
}                     = require('./getCheckinoutPrice');
const getPackPrice    = require('./getPackPrice');
const getPeriodPrice   = require('./getPeriodPrice');
const getServiceFees  = require('./getServiceFees');
const logAndSend      = require('./logAndSend');
const getCheckinoutDuration = require('./getCheckinoutDuration');
const getCheckoutLateNotice = require('./getCheckoutLateNotice');
const getRoomSwitchPrice    = require('./getRoomSwitchPrice');

module.exports = {
  euroRound,
  getCheckinPrice,
  getCheckoutPrice,
  getPackPrice,
  getPeriodPrice,
  getServiceFees,
  logAndSend,
  getCheckinoutDuration,
  getCheckoutLateNotice,
  getRoomSwitchPrice,
};
