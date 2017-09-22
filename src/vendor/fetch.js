const fetch   = require('node-fetch');
const Promise = require('bluebird');

fetch.Promise = Promise;

module.exports = fetch;
