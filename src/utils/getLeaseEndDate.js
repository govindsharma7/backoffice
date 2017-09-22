const D         = require('date-fns');
const { LEASE_DURATION } = require('../const');

module.exports = function(startDate) {
  return D.addMonths(D.subDays(startDate, 1), LEASE_DURATION);
};
