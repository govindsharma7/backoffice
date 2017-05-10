#!/usr/bin/env node

/* eslint-disable import/no-dynamic-require */
const path   = require('path');
const models = require('../src/models');

// Object.entries polyfill
Object.entries = typeof Object.entries === 'function' ?
  Object.entries :
  (obj) => Object.keys(obj).map(k => [k, obj[k]]);

if (
  process.env.NODE_ENV !== 'test' &&
  process.env.NODE_ENV !== 'development' &&
  !process.argv.includes('--force')
) {
  throw new Error(`
/!\\ WARNING /!\\
This script will erase all your data!
Use "--force" if you're certain you want to do that.
  `);
}

/* eslint-disable promise/no-nesting */
return models.sequelize.sync({ force: true })
  .then(() => {
    // We used to just load all files in the folder, but the order we load them
    // is important because of references constraints
    return [
      'apartments.json',
      'rooms.json',
      'clients.json',
      'products.json',
      'rentings.json',
      'orders.json',
      'orderItems.json',
      'settings.json',

    ].map((file) => {
      return () => {
        const {model, records} = require(path.join('..', 'data', file));

        console.log(`Loading ${records.length} records of model "${model}"`);
        return models[model].bulkCreate(records, { hooks: false })
          .catch((err) => {
            console.error(`Failed loading records for model "${model}"`);
            if ( 'errors' in err ) {
              console.log(err.errors);
            }

            throw err;
          });
      };
    })
    // Load entities in serie
    .reduce((prev, curr) => {
      return prev.then(curr);
    }, Promise.resolve(true));
  })
  .then(() => {
    return console.log('DATABASE SUCCESSFULLY FIXTURED!');
  });
