const Express    = require('express');
const Jwt        = require('express-jwt');
const Cors       = require('express-cors');
const BodyParser = require('body-parser');
const Liana      = require('forest-express-sequelize');
const config     = require('./config');
const models     = require('./models');

const parentApp = Express();
const app = Express();

/*
 * Middleware that will handle our custom Forest routes
 */
// JWT
app.use(Jwt({
  secret: config.FOREST_AUTH_SECRET,
  credentialsRequired: false,
}));

// CORS
app.use(Cors({
  allowedOrigins: ['localhost:4200', '*.forestadmin.com'],
  headers: ['Authorization', 'X-Requested-With', 'Content-Type'],
}));

// Mime type
app.use(BodyParser.json());

// This hook and all app.use above are currently useless
Object.keys(models).forEach(function(modelName) {
  if ('beforeLianaInit' in models[modelName]) {
    models[modelName].beforeLianaInit(models, app);
  }
});

parentApp.use(app);

/*
 * Forest middleware
 */
parentApp.use(Liana.init({
  modelsDir: __dirname + '/models', // models directory.
  envSecret: config.FOREST_ENV_SECRET,
  authSecret: config.FOREST_AUTH_SECRET,
  sequelize: models.sequelize, // sequelize database connection.
}));

// This hook is currently useless
Object.keys(models).forEach(function(modelName) {
  if ('afterLianaInit' in models[modelName]) {
    models[modelName].afterLianaInit(models);
  }
});

module.exports = parentApp;
