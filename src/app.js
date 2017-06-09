const path         = require('path');
const Express      = require('express');
const Jwt          = require('express-jwt');
const Cors         = require('cors');
const BodyParser   = require('body-parser');
const Liana        = require('forest-express-sequelize');
const GraphQLHTTP  = require('express-graphql');
const {maskErrors} = require('graphql-errors');
const config       = require('./config');
const models       = require('./models');
const checkToken   = require('./middlewares/checkToken');
const Utils        = require('./utils');

const parentApp = Express();
const app = Express();
const graphqlApp = Express();

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
  origin: [/^http:\/\/127\.0\.0\.1:/, /^http:\/\/localhost:/, /\.forestadmin\.com$/],
  allowedHeaders: [
    'Authorization',
    'X-Requested-With',
    'Content-Type',
    'Access-Control-Allow-Origin',
  ],
}));

// Mime type
app.use(BodyParser.json());

// This hook is for routes that need to override Forest-generated routes
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

// This hook is for additional routes
Object.keys(models).forEach(function(modelName) {
  if ('afterLianaInit' in models[modelName]) {
    models[modelName].afterLianaInit(parentApp);
  }
});

const schema = Utils.sequelizeSchema(models);

if ( config.NODE_ENV ) {
  maskErrors(schema);
}
/*
 * GraphQL middleware
 */
graphqlApp.use(GraphQLHTTP({
  schema,
  graphiql: true,
}));

parentApp.use('/graphql', graphqlApp);

module.exports = parentApp;
