const Promise = require('bluebird');

function WebMergePromiseAPI() {
  this.mergeDocument = () => Promise.resolve(true);
}

module.exports = {
  WebMergePromiseAPI,
};
