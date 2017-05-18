const D                      =  require('date-fns');
const {LATE_NOTICE_CHECKOUT} =  require('../const');

module.exports = function(date) {
  var differenceDays = D.differenceInDays(date, new Date());

  if ( differenceDays < 10 ) {
    return LATE_NOTICE_CHECKOUT.veryLate;
  }
  else if ( differenceDays >= 10 && differenceDays <= 19 ) {
    return LATE_NOTICE_CHECKOUT.late;
  }
  else if ( differenceDays > 19 && differenceDays <= 29 ) {
    return LATE_NOTICE_CHECKOUT.bitLate;
  }
    return LATE_NOTICE_CHECKOUT.good;
};
