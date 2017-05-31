const Promise        = require('bluebird');
const {SERVICE_FEES} = require('../const');

module.exports = function(roomCount) {
  // make this method artificially asynchronous, as it is likely to read from
  // the DB in the future.
  return Promise.resolve(
    roomCount != null &&
    roomCount in SERVICE_FEES ? SERVICE_FEES[roomCount] : SERVICE_FEES.default
  );
};
