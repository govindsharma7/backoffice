const Promise                 = require('bluebird');
const D                       = require('date-fns');
const Holidays                = require('date-holidays');
const {
  BASIC_PACK,
  PRIVILEGE_PACK,
  SPECIAL_CHECKIN_PRICE,
}                             = require('../const');

function isWorkingHours(date) {
  const startOfDay = D.startOfDay(date);

  return D.isWithinRange(
    date,
    D.addHours(startOfDay, 9),
    D.addHours(startOfDay, 19)
  );
}

const h = new Holidays('FR');

function isSpecialDate(date) {
  return D.isWeekend(date) || !isWorkingHours(date) || h.isHoliday(date);
}

module.exports.getCheckinPrice = function(date, level) {
  if ( level === BASIC_PACK && isSpecialDate(date) ) {
    return Promise.resolve(SPECIAL_CHECKIN_PRICE);
  }

  return Promise.resolve(0);
};

module.exports.getCheckoutPrice = function(date, level) {
  if ( level !== PRIVILEGE_PACK && isSpecialDate(date) ) {
    return Promise.resolve(SPECIAL_CHECKIN_PRICE);
  }

  return Promise.resolve(0);
};
