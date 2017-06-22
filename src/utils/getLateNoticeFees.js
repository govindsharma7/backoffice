const Promise            = require('bluebird');
const D                  = require('date-fns');
const {LATE_NOTICE_FEES} = require('../const');


module.exports = function(type, date) {
  const differenceDays = D.differenceInDays(date, new Date());

  // there are no late-notice fees for a checkin
  if ( type === 'checkin' ) {
    return Promise.resolve(0);
  }
  if ( differenceDays <= 9 ) {
    return Promise.resolve(LATE_NOTICE_FEES['0-9days']);
  }
  if ( differenceDays >= 10 && differenceDays <= 19 ) {
    return Promise.resolve(LATE_NOTICE_FEES['10-19days']);
  }
  if ( differenceDays >= 20 && differenceDays <= 29 ) {
    return Promise.resolve(LATE_NOTICE_FEES['20-29days']);
  }

  return Promise.resolve(0);
};
