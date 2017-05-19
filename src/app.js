const path       = require('path');
const Express    = require('express');
const Jwt        = require('express-jwt');
const Cors       = require('express-cors');
const BodyParser = require('body-parser');
const Liana      = require('forest-express-sequelize');
const config     = require('./config');
const models     = require('./models');
const checkToken = require('./middlewares/checkToken');

const parentApp = Express();
const app = Express();

/*
 * Middleware that will handle our custom Forest routes
 */
// JWT authentication
app.use(Jwt({
  secret: config.FOREST_AUTH_SECRET,
  credentialsRequired: false,
}));

// Token authentication
app.use(checkToken);

// CORS
app.use(Cors({
  allowedOrigins: ['localhost:*', '*.forestadmin.com'],
  headers: [
    'Authorization',
    'X-Requested-With',
    'Content-Type',
    'Access-Control-Allow-Origin',
  ],
}));

// Mime type
app.use(BodyParser.json());

// This hook and all app.use above are currently useless
Object.keys(models).forEach(function(modelName) {
  if ('beforeLianaInit' in models[modelName]) {
    models[modelName].beforeLianaInit(app);
  }
});

parentApp.use(app);

/*
 * Forest middleware
 */
parentApp.use(Liana.init({
  modelsDir: path.join(__dirname, '/models'), // models directory.
  envSecret: config.FOREST_ENV_SECRET,
  authSecret: config.FOREST_AUTH_SECRET,
  sequelize: models.sequelize, // sequelize database connection.
}));

// This hook is currently useless
Object.keys(models).forEach(function(modelName) {
  if ('afterLianaInit' in models[modelName]) {
    models[modelName].afterLianaInit(parentApp);
  }
});

module.exports = parentApp;
