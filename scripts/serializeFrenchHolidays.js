// Creates a list of holidays for the next ten years
const Holidays = require('date-holidays');

const frHolidays = new Holidays('FR');
const holidaysList = [];
const currYear = new Date().getFullYear();

function getHolidays(year) {
  return frHolidays.getHolidays(year, 'FR').filter((holiday) =>
    holiday.type === 'public'
  );
}

for ( let year = currYear; year < currYear + 10; year++ ) {
  [].push.apply(holidaysList, getHolidays(year));
}

console.log(JSON.stringify(holidaysList, null, '  '));
