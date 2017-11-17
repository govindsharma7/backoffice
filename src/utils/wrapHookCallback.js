const Promise = require('bluebird');

module.exports = function(callback) {
  return function() {
    return Promise.resolve()
      .then(() => callback.apply(null, arguments))
      .thenReturn(true)
      .tapCatch(console.error);
  };
};
