const Promise = require('bluebird');

module.exports = {
  geocode() {
    return Promise.resolve({
      lat: 45.752021,
      lng: 4.826661,
    });
  },
};
