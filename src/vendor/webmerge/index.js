const webMergeApi = require('webmerge').WebMergePromiseAPI;
const Promise     = require('bluebird');
const config      = require('../../config');


const webMerge = new webMergeApi(
  config.WEBMERGE_API_KEY,
  config.WEBMERGE_SECRET,
  Promise
);

module.exports = webMerge;
