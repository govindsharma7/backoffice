const Promise            = require('bluebird');
const D                  = require('date-fns');
const {
  CHECKIN_DURATION,
  CHECKOUT_DURATION,
}                        = require('../const');

module.exports.getCheckinEndDate = function(startDate) {
  return Promise.resolve(D.addMinutes(startDate, CHECKIN_DURATION));
};

module.exports.getCheckoutEndDate = function(startDate) {
  return Promise.resolve(D.addMinutes(startDate, CHECKOUT_DURATION));
};
