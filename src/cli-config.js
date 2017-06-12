// The config must be exposed differently for sequelize-cli
const config = require('./config');

// We always return a config file with only the 'development' environment
// (the default value for sequelize-cli), as environment selection happens
// automatically in config.js for us.
module.exports = {
  development: {
    username: config.SEQUELIZE_USERNAME,
    password: config.SEQUELIZE_PASSWORD,
    database: config.SEQUELIZE_DATABASE,
    host:     config.SEQUELIZE_HOST,
    dialect:  config.SEQUELIZE_DIALECT,
  },
};
