const path = require('path');
/* eslint-disable import/no-dynamic-require */
const config = require(
  path.join(__dirname, (process.env.NODE_ENV || 'development') + '.js')
);

module.exports = config;
