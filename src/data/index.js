#!/usr/bin/env node

/*
 * /!\ Watch out /!\
 * This script will reset the DB and you'll lose all your data!
 */
/* eslint-disable import/no-dynamic-require */
const path   = require('path');
const models = require('../models');

if ( process.env.NODE_ENV !== 'development' ) {
	return console.log('DB reset is only possible in development');
}

models.sequelize.sync({ force: true })
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

    ].map((file) => {
      return () => {
        const {model, records} = require(path.join(__dirname, file));

        console.log(`Loading ${records.length} records of model "${model}"`);
        return models[model].bulkCreate(records)
          .catch((err) => {
            console.error(`Failed loading records for model "${model}"`);

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
    console.log('DATABASE SUCCESSFULLY RESET!')
  });
