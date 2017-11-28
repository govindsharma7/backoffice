#!/usr/bin/env node

/* eslint-disable import/no-dynamic-require */
const Promise   = require('bluebird');
const models    = require('../src/models');
const sequelize = require('../src/models/sequelize');
const seed      = require('../seed');

// Object.entries polyfill
Object.entries = typeof Object.entries === 'function' ?
  Object.entries :
  (obj) => Object.keys(obj).map((k) => [k, obj[k]]);

return sequelize.sync()
  .then(() =>
    Promise.mapSeries(Object.entries(seed), ([modelName, records]) =>
      models[modelName].bulkCreate(records, { ignoreDuplicates: true })
      // In case of mistake, it's possible to upsert all records
      // but invoice-counter and other settings should be left untouched
      // models[modelName].bulkCreate(records, {
      //   ignoreDuplicates: modelName === 'Setting'
      //   updateOnDuplicate: modelName !== 'Setting',
      // })
  ))
  .then(() => {
    console.log('DATABASE SUCCESSFULLY SEEDED!');
    return process.exit(0);
  });
