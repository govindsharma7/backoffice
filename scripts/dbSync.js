#!/usr/bin/env node

const models = require('../src/models');

return models.sequelize.sync()
  .then(() => {
    return console.log('DATABASE SUCCESSFULLY SYNCHRONIZED!');
  });
