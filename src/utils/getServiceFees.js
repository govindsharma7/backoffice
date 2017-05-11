const Promise = require('bluebird');

module.exports = function(roomCount) {
  let serviceFees;

  switch (roomCount) {
  case 1:
    serviceFees = 50000;
    break;
  case 2:
    serviceFees = 4000;
    break;
  default:
    serviceFees = 3000;
  }

  // make this method artificially asynchronous, as it is likely to read from
  // the DB in the future.
  return Promise.resolve(serviceFees);
};
