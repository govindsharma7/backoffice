const Promise                = require('bluebird');
const D                      = require('date-fns');
const {LATE_NOTICE_CHECKOUT} = require('../const');


module.exports = function(date) {
  var differenceDays = D.differenceInDays(date, new Date());

  if ( differenceDays < 10 ) {
    return Promise.resolve(LATE_NOTICE_CHECKOUT.veryLate);
  }
  else if ( differenceDays >= 10 && differenceDays <= 19 ) {
    return Promise.resolve(LATE_NOTICE_CHECKOUT.late);
  }
  else if ( differenceDays > 19 && differenceDays <= 29 ) {
    return Promise.resolve(LATE_NOTICE_CHECKOUT.bitLate);
  }

  return Promise.resolve(LATE_NOTICE_CHECKOUT.good);
};
