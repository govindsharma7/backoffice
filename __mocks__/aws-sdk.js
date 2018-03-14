const Promise = require('bluebird');

function S3() {
  this.upload = () => ({ promise() {
    return Promise.resolve('http://test.com/file');
  } });
  this.deleteObject = () => ({ promise() {
    return Promise.resolve(true);
  } });
  this.deleteObject = () => ({ promise() {
    return Promise.resolve(true);
  } });
}

module.exports = {
  config: {
    update() {},
    setPromisesDependency() {},
  },
  S3,
};
