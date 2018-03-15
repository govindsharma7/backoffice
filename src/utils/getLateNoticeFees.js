const Promise               = require('bluebird');
const D                     = require('date-fns');
const { LATE_NOTICE_FEES }  = require('../const');

// we can't use Utils.now in this file as we wouldn't be able to mock it
// → now should always be a parameter
module.exports = function(type, date, now) {
  const differenceDays = D.differenceInDays(date, now);

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
