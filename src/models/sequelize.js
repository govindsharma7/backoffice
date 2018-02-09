const Sequelize   = require('sequelize');
const config      = require('../config');

const sequelize = new Sequelize(
  config.SEQUELIZE_DATABASE,
  config.SEQUELIZE_USERNAME,
  config.SEQUELIZE_PASSWORD,
  {
    host: config.SEQUELIZE_HOST,
    dialect: config.SEQUELIZE_DIALECT,
    // this file is used when dialect is sqlite
    storage: config.SEQUELIZE_HOST,
    // WTF Sequelize??
    define: {
      freezeTableName: true,
    },
    benchmark: true,
    // Symbol operators are far from stable yet
    operatorsAliases: true,
  }
);

module.exports = sequelize;
