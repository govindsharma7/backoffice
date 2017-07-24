const Promise        = require('bluebird');
const {LEASE} = require('../const');

module.exports = function(roomCount, version) {
  const serviceFees = LEASE[version].SERVICE_FEES;

  // make this method artificially asynchronous, as it is likely to read from
  // the DB in the future.
  return Promise.resolve(
    roomCount != null && ( serviceFees[roomCount] || serviceFees.default )
  );
};
