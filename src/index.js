#!/usr/bin/env node

/* eslint-disable no-console */
const http = require('http');
const app = require('./app');
const models = require('./models');
const config = require('./config');

/*
 * Initialize server
 */
const port = normalizePort(config.SERVER_PORT || '3000');

app.set('port', port);
const server = http.createServer(app);

/*
 * Load models
 */
return models.sequelize.sync().then(() => {
  server.listen(port, function() {
    console.log(`Express server listening on port ${server.address().port}`);
  });
  server.on('error', onError);
  server.on('listening', onListening);
  return null;
});

/*
 * Utils
 */
function normalizePort(val) {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    return val;
  }

  if (port >= 0) {
    return port;
  }

  return false;
}

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string' ? `Pipe ${port}` : `Port ${port}`;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening() {
  const addr = server.address();
  const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;

  console.log(`Listening on ${bind}`);
}
