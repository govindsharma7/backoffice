const fs        = require('fs');
const path      = require('path');
const Sequelize = require('sequelize');

const database = process.env.NODE_ENV === 'production' ?
  process.env.SEQUELIZE_DATABASE : process.env.SEQUELIZE_TEST_DATABASE;
const dialect = process.env.NODE_ENV === 'production' ?
  'mysql' : 'sqlite';
const sequelize = new Sequelize(
  database,
  process.env.SEQUELIZE_USERNAME,
  process.env.SEQUELIZE_PASSWORD,
  {
    host: process.env.SEQUELIZE_HOST,
    dialect: dialect,
    storage: '.database.sqlite',
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
