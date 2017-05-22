const Promise            = require('bluebird');
const D                  = require('date-fns');
const {LATE_NOTICE_FEES} = require('../const');


module.exports = function(date) {
  var differenceDays = D.differenceInDays(date, new Date());

  if ( differenceDays <= 9 ) {
    return Promise.resolve(LATE_NOTICE_FEES['0-9days']);
  }
  else if ( differenceDays >= 10 && differenceDays <= 19 ) {
    return Promise.resolve(LATE_NOTICE_FEES['10-19days']);
  }
  else if ( differenceDays >= 20 && differenceDays <= 29 ) {
    return Promise.resolve(LATE_NOTICE_FEES['20-29days']);
  }

  return Promise.resolve(0);
};
