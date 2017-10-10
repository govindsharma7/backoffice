const Express           = require('express');
const Jwt               = require('express-jwt');
const Cors              = require('cors');
const BodyParser        = require('body-parser');
const Liana             = require('forest-express-sequelize');
const values            = require('lodash/values');
const Promise           = require('bluebird');
const config            = require('./config');
const models            = require('./models');
const aws               = require('./vendor/aws');
const geocode           = require('./vendor/geocode');
const payline           = require('./vendor/payline');
const sendinblue        = require('./vendor/sendinblue');
const webmerge          = require('./vendor/webmerge');
const checkToken        = require('./middlewares/checkToken');
const makePublic        = require('./middlewares/makePublic');
const smartCollections  = require('./smart-collections');


const parentApp = Express();
const app       = Express();
const {Schemas} = Liana;
const _         = { values };

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
  origin: [
    /^http:\/\/0\.0\.0\.0:/,
    /^http:\/\/127\.0\.0\.1:/,
    /^http:\/\/localhost:/,
    /\.forestadmin\.com$/,
    /\.chez-nestor\.com$/,
  ],
  allowedHeaders: [
    'Authorization',
    'X-Requested-With',
    'Content-Type',
    'Access-Control-Allow-Origin',
  ],
}));

// Mime type
app.use(BodyParser.json({limit: '6mb'}));

_.values(models).forEach(function(model) {
  if ('routes' in model) {
    model.routes(app, models, model);
  }
});

// Global route used to verify that the backend is up, running and connected to
// the DB and all external services
app.get('/ping', makePublic, (req, res) => {
  Promise.all([
    models.Client.findOne(),
    aws.pingService(),
    geocode('16 rue de Condé, 69002, Lyon'),
    payline.pingService(),
    sendinblue.pingService(),
    webmerge.pingService(),
  ]).then(() => {
    return res.send('pong');

  }).catch((e) => {
    return res.status(500).send(e);
  });
});

parentApp.use(app);

// - Hijack Schemas.perform to load Liana collections ourselves
//   → definitely prevent forest-express from trapping our errors, YAY!
// - Hijack integrator.defineCollections to throw before apimap updates
//   → prevent deploys from overwriting production layout, YAY!
Schemas._perform = Schemas.perform;
Schemas.perform = function(Implementation, integrator) {
  // Hijack integrator.defineCollections
  integrator._defineCollections = integrator.defineCollections;
  integrator.defineCollections = function() {
    integrator._defineCollections.apply(integrator, arguments);
    if ( config.NODE_ENV === 'production' ) {
      throw new Error('You shall not pass!');
    }
  };

  return Schemas._perform.apply(Schemas, arguments).tap(() => {
    // load collections for models
    Object.keys(models).forEach((modelName) => {
      if ('collection' in models[modelName]) {
        Liana.collection( modelName, models[modelName].collection(models) );
      }
    });
    // load smart collections
    Object.keys(smartCollections).forEach((name) => {
      Liana.collection( name, smartCollections[name](models) );
    });
  });
};

/*
 * Forest middleware
 */
parentApp.use(Liana.init({
  sequelize: models.sequelize,
  envSecret: config.FOREST_ENV_SECRET,
  authSecret: config.FOREST_AUTH_SECRET,
}));

// This hook is currently useless
Object.keys(models).forEach(function(modelName) {
  if ('afterLianaInit' in models[modelName]) {
    models[modelName].afterLianaInit(parentApp, models, models[modelName]);
  }
});

module.exports = parentApp;
