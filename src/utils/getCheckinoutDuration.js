const Promise            = require('bluebird');
const D                  = require('date-fns');
const {CHECKIN_DURATION,
      CHECKOUT_DURATION} = require('../const');

module.exports = function(date, type) {
  var endDate;

  switch (type) {

    case 'checkin':
      endDate = D.addMinutes(date, CHECKIN_DURATION);
      break;
    case 'checkout':
      endDate = D.addMinutes(date, CHECKOUT_DURATION);
      break;
    default:
      endDate = date;
  }
  return Promise.resolve(endDate);
};
