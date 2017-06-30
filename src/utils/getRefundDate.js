const Promise = require('bluebird');
const D       = require('date-fns');
const {LEASE} = require('../const');

module.exports = function(date, comfortLevel, version) {
  return Promise.resolve(
    D.addDays(date, LEASE[version].DEPOSIT_REFUND_DELAYS[comfortLevel])
  );
};
