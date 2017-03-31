const fs = require('fs');
const path = require('path');

const env = JSON.parse(fs.readFileSync(path.resolve('.env-cmdrc'), 'utf8'));

module.exports = env[process.env.NODE_ENV || 'development'];
