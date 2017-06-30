const Promise            = require('bluebird');
const D                  = require('date-fns');
const {LEASE}            = require('../const');


module.exports = function(type, date, version) {
  const differenceDays = D.differenceInDays(date, new Date());
  const lateNoticeFees = LEASE[version].LATE_NOTICE_FEES;

  // there are no late-notice fees for a checkin
  if ( type === 'checkin' ) {
    return Promise.resolve(0);
  }
  if ( differenceDays <= 9 ) {
    return Promise.resolve(lateNoticeFees['0-9days']);
  }
  if ( differenceDays >= 10 && differenceDays <= 19 ) {
    return Promise.resolve(lateNoticeFees['10-19days']);
  }
  if ( differenceDays >= 20 && differenceDays <= 29 ) {
    return Promise.resolve(lateNoticeFees['20-29days']);
  }

  return Promise.resolve(0);
};
