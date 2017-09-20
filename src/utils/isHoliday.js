const holidays = require('../holidays.json');

module.exports = function isHoliday(date) {
  const sDate = date.toISOString();

  for ( let holiday of holidays ) {
    if ( sDate < holiday.end && sDate > holiday.start ) {
      return true;
    }

    if ( sDate < holiday.start ) {
      return false;
    }
  }

  return false;
};
