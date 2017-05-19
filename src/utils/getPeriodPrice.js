const D            = require('date-fns');
const Promise      = require('bluebird');
const {RENT_COEFS} = require('../const') ;

module.exports = function(basePrice, date) {
  // make this method artificially asynchronous, as it is likely to read from
  // the DB in the future.
  return Promise.resolve(basePrice * RENT_COEFS[D.format(date, 'DDD')]);
};
