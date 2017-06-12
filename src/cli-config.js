// The config must be exposed differently for sequelize-cli
const config = require('./config');

module.exports = {
  [config.NODE_ENV]: {
    username: config.SEQUELIZE_USERNAME,
    password: config.SEQUELIZE_PASSWORD,
    database: config.SEQUELIZE_DATABASE,
    host:     config.SEQUELIZE_HOST,
    dialect:  config.SEQUELIZE_DIALECT,
  },
};
