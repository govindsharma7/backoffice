#!/usr/bin/env node
const fetch               = require('node-fetch');
const config              = require('../src/config');

return fetch(`${config.REST_API_URL}/ping`)
  .then((response) => {
    if ( !response.ok ) {
      return response.text()
        .then((error) => { throw new Error(error); });
    }

    return console.log('pong');
  }) ;
