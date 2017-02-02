const express = require('express');
const forestExpressSequelize = require('forest-express-sequelize');

const app = express();

app.use(forestExpressSequelize.init({
  modelsDir: __dirname + '/models', // models directory.
  envSecret: process.env.FOREST_ENV_SECRET,
  authSecret: process.env.FOREST_AUTH_SECRET,
  sequelize: require('./models').sequelize, // sequelize database connection.
}));

module.exports = app;
