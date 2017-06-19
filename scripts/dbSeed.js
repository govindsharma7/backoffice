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

    return Promise.all(promises);
  })
  .then(() => {
    return console.log('DATABASE SUCCESSFULLY SEEDED!');
  });
