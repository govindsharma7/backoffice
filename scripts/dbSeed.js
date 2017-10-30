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
    const tuples = [];

    for (let [modelName, records] of Object.entries(seed)) {
      for (let record of records) {
        tuples.push([modelName, record]);
      }
    }
    // use Promise.map instead of Promise.all, as .map limits paralellism
    // (while .all results in "database is locked" sqlite errors)
    // TODO try to make this run with .map and concurrency
    return Promise.mapSeries(tuples, ([modelName, record]) => {
      return models[modelName]
        .findOrCreate({
          where: { id: record.id },
          defaults: record,
        });
    });
  })
  .then(() => {
    console.log('DATABASE SUCCESSFULLY SEEDED!');
    return process.exit(0);
  });
