const Mysqldump = require('mysqldump');
const Promise   = require('bluebird');
const config    = require('../src/config');

const mysqldump = Promise.promisify(Mysqldump);

return mysqldump({
  host: config.SEQUELIZE_HOST,
  user: config.SEQUELIZE_USERNAME,
  password: config.SEQUELIZE_PASSWORD,
  database: config.SEQUELIZE_DATABASE,
  dest: process.argv[2],
});
