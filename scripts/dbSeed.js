#!/usr/bin/env node

/* eslint-disable import/no-dynamic-require */
const models = require('../src/models');
const seed   = require('../seed');

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
This script will reset seed data!
Use "--force" if you're certain you want to do that.
  `);
}

/* eslint-disable promise/no-nesting */
return models.sequelize.sync()
  .then(() => {
    const promises = [];

    for (let [modelName, records] of Object.entries(seed)) {
      for (let record of records) {
        promises.push(models[modelName].upsert(record));
      }
    }

    return Promise.all(promises);
  })
  .then(() => {
    return console.log('DATABASE SUCCESSFULLY SEEDED!');
  });
