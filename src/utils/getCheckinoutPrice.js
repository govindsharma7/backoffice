const Promise                 = require('bluebird');
const D                       = require('date-fns');
const {
  HOME_CHECKIN_FEES,
  SPECIAL_CHECKIN_FEES,
  SPECIAL_CHECKOUT_FEES,
}                             = require('../const');
const isHoliday               = require('./isHoliday');

function isWorkingHours(date) {
  const startOfDay = D.startOfDay(date);

  return D.isWithinRange(
    date,
    D.addHours(startOfDay, 9),
    D.addHours(startOfDay, 18)
  );
}

function isSpecialDate(date) {
  return D.isWeekend(date) || !isWorkingHours(date) || isHoliday(date);
}

module.exports.getCheckinPrice = function(date, level) {
  if ( isSpecialDate(date) ) {
    return Promise.resolve(SPECIAL_CHECKIN_FEES[level]);
  }

  return Promise.resolve(HOME_CHECKIN_FEES[level]);
};

module.exports.getCheckoutPrice = function(date, level) {
  if ( isSpecialDate(date) ) {
    return Promise.resolve(SPECIAL_CHECKOUT_FEES[level]);
  }

  return Promise.resolve(0);
};
