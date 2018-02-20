const Mysqldump = require('mysqldump');
const Promise   = require('bluebird');
const _         = require('lodash');
const config    = require('../src/config');
const models    = require('../src/models');

const mysqldump = Promise.promisify(Mysqldump);

return mysqldump({
  host: config.SEQUELIZE_HOST,
  user: config.SEQUELIZE_USERNAME,
  password: config.SEQUELIZE_PASSWORD,
  database: config.SEQUELIZE_DATABASE,
  tables: _.filter(models, (model) => !model.isView).map((model) => model.name),
  dest: process.argv[2],
});
