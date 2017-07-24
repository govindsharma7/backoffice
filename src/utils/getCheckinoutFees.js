const Promise                 = require('bluebird');
const D                       = require('date-fns');
const Holidays                = require('date-holidays');
const {
  BASIC_PACK,
  PRIVILEGE_PACK,
  LEASE,
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

module.exports.getCheckinPrice = function(date, level, version) {
  if ( level === BASIC_PACK && isSpecialDate(date) ) {
    return Promise.resolve(LEASE[version].SPECIAL_CHECKIN_FEES);
  }

  return Promise.resolve(0);
};

module.exports.getCheckoutPrice = function(date, level, version) {
  if ( level !== PRIVILEGE_PACK && isSpecialDate(date) ) {
    return Promise.resolve(LEASE[version].SPECIAL_CHECKIN_FEES);
  }

  return Promise.resolve(0);
};
