const fs = require('fs');
const path = require('path');

const env = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', '.env-cmdrc'), 'utf8')
);
const NODE_ENV = process.env.NODE_ENV || 'development';

module.exports = env[NODE_ENV];
