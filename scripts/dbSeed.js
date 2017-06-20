#!/usr/bin/env node

/* eslint-disable import/no-dynamic-require */
const Promise = require('bluebird');
const models  = require('../src/models');
const seed    = require('../seed');

// Object.entries polyfill
Object.entries = typeof Object.entries === 'function' ?
  Object.entries :
  (obj) => { return Object.keys(obj).map((k) => { return [k, obj[k]]; }); };

/* eslint-disable promise/no-nesting */
return models.sequelize.sync()
  .then(() => {
    const promises = [];

    for (let [modelName, records] of Object.entries(seed)) {
      for (let record of records) {
        promises.push(models[modelName].findOrCreate({
          where: { id: record.id },
          defaults: record,
        }));
      }
    }

    // use Promise.map instead of Promise.all, as .map limits paralellism
    // (while .all results in "database is locked" sqlite errors)
    return Promise.map(promises, (promise) => {
      return promise;
    });
  })
  .then(() => {
    console.log('DATABASE SUCCESSFULLY SEEDED!');
    return process.exit(0);
  });
