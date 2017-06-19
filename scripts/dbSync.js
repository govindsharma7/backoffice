#!/usr/bin/env node

const models = require('../src/models');

return models.sequelize.sync()
  .then(() => {
    console.log('DATABASE SUCCESSFULLY SYNCHRONIZED!');
    return process.exit(0);
  });
