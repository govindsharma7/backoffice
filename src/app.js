const Express           = require('express');
const Jwt               = require('express-jwt');
const Cors              = require('cors');
const BodyParser        = require('body-parser');
const Liana             = require('forest-express-sequelize');
const forEach           = require('lodash/forEach');
const cookieParser      = require('cookie-parser');
const Promise           = require('bluebird');
// const GraphQLHTTP       = require('express-graphql');
// const { maskErrors }    = require('graphql-errors');
// const Utils             = require('./utils');
const config            = require('./config');
const sequelize         = require('./models/sequelize');
const models            = require('./models');
const routes            = require('./routes');
const checkToken        = require('./middlewares/checkToken');
const smartCollections  = require('./smart-collections');

const parentApp   = Express();
const app         = Express();
// const graphqlApp  = Express();
const { Schemas } = Liana;
const _           = { forEach };

/*
 * Middleware that will handle our custom Forest routes
 */
app.use(cookieParser());

// JWT authentication
app.use(Jwt({
  secret: config.FOREST_AUTH_SECRET,
  credentialsRequired: false,
  getToken(request) {
    if (
      request.cookies && request.cookies.authorized &&
      request.cookies.authorized.split(' ')[0] === 'Bearer'
    ) {
      return request.cookies.authorized.split(' ')[1];
    }
    if (
      request.headers && request.headers.authorization &&
      request.headers.authorization.split(' ')[0] === 'Bearer'
    ) {
      return request.headers.authorization.split(' ')[1];
    }
    if ( request.query && request.query.sessionToken ) {
      return request.query.sessionToken;
    }
    return null;
  },
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
    'Access-Control-Allow-Credentials',
    'Set-Cookie',
  ],
  credentials: true,
}));

// Mime type
app.use(BodyParser.json({ limit: '50mb' }));
app.use(BodyParser.urlencoded({ limit: '50mb', extended: true }));

_.forEach(models, function(model) {
  if ('routes' in model) {
    model.routes(app, models);
  }
});
_.forEach(smartCollections, function(smartCollection) {
  if ('routes' in smartCollection) {
    smartCollection.routes(app, models);
  }
});


// Register non-model-specific routes (e.g. ping and login)
routes(app);

parentApp.use(app);

/*
 * GraphQL middleware
 * TODO:
 * - For some reason, Model.findById no longer returns a bluebird Promise
 */
// const schema = Utils.sequelizeSchema(models);
//
// if ( config.NODE_ENV === 'production' ) {
//   maskErrors(schema);
// }
//
// graphqlApp.use(GraphQLHTTP({
//   schema,
//   graphiql: true,
// }));
//
// parentApp.use('/graphql', graphqlApp);

/* eslint-disable promise/avoid-new */
module.exports = new Promise((resolve) => {
/* eslint-enable promise/avoid-new */

  // - Hijack Schemas.perform to load Liana collections ourselves
  //   → definitely prevent forest-express from trapping our errors, YAY!
  // - Hijack integrator.defineCollections to:
  //   - resolve the exported promise so that the server starts to listen
  //     → prevent 404 on server cold-start
  //   - throw before apimap updates DEPRECATED
  //     → prevent deploys from overwriting production layout, YAY!
  Schemas._perform = Schemas.perform;
  Schemas.perform = function(Implementation, integrator) {
    // Hijack integrator.defineCollections
    integrator._defineCollections = integrator.defineCollections;
    integrator.defineCollections = function() {
      integrator._defineCollections.apply(integrator, arguments);
      // routes are now ready, server can listen for requests
      resolve(parentApp);
      // if ( config.NODE_ENV === 'production' ) {
      //   throw new Error('You shall not pass!');
      // }
    };

    return Schemas._perform.apply(Schemas, arguments).tap(() => {
      // load collections for models
      _.forEach(models, (model, modelName) => {
        if ('collection' in model) {
          Liana.collection( modelName, model.collection(models) );
        }
      });
      // load smart collections
      _.forEach(smartCollections, (smartCollection, name) => {
        Liana.collection( name, smartCollection.collection(models) );
      });
    });
  };

  /*
   * Forest middleware
   */
  parentApp.use(Liana.init({
    sequelize,
    envSecret: config.FOREST_ENV_SECRET,
    authSecret: config.FOREST_AUTH_SECRET,
  }));

  /* eslint-disable no-unused-vars */
  parentApp.use((err, req, res, next) => {
  /* eslint-enable no-unused-vars */
    const message = err.longMessage || err.shortMessage || err.message;

    console.error(message);
    if ( err.stack ) {
      console.error(err.stack);
    }

    res
      .status(err.status || 400)
      .send({ error: message, code: err.code || 'UNEXPECTED' });
  });
});
