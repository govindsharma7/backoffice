const Promise = require('bluebird');
const {PACK_PRICES} = require('../const');

module.exports = function(city, level) {
  // make this method artificially asynchronous, as it is likely to read from
  // the DB in the future.
  return Promise.resolve(PACK_PRICES[city][level]);
};
