const Promise = require('bluebird');

module.exports = {
  makeRoomUnavailable() {
    return Promise.resolve(true);
  },
};
