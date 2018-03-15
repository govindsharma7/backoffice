#!/usr/bin/env node
const fetch               = require('node-fetch');
const config              = require('../src/config');

return fetch(`${config.REST_API_URL}/ping`)
  .then(async (response) => {
    if ( !response.ok ) {
      const error = await response.text();

      throw new Error(error);
    }

    return console.log('pong');
  }) ;
