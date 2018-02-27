const Mysqldump = require('mysqldump');
const Promise   = require('bluebird');
const _         = require('lodash');
const config    = require('../src/config');
const models    = require('../src/models');

const mysqldump = Promise.promisify(Mysqldump);
const tables =
  _.filter(models, (model) => !model.isView)
  .map((model) => model.name)
  .concat('SequelizeMeta');

return mysqldump({
  host: config.SEQUELIZE_HOST,
  user: config.SEQUELIZE_USERNAME,
  password: config.SEQUELIZE_PASSWORD,
  database: config.SEQUELIZE_DATABASE,
  tables,
  dest: process.argv[2],
});
