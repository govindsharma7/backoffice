const fs          = require('fs');
const path        = require('path');
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
  }
);
const db = {};

fs.readdirSync(__dirname)
  .filter(function(file) {
    return (file.indexOf('.') !== 0) && (file !== 'index.js');
  })
  .forEach(function(file) {
    var model = sequelize.import(path.join(__dirname, file));

    db[model.name] = model;
  });

Object.keys(db).forEach(function(modelName) {
  if ('associate' in db[modelName]) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
