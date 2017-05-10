#!/usr/bin/env node

const models = require('../src/models');

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

return models.sequelize.sync({ force: true })
  .then(() => {
    return console.log('DATABASE SUCCESSFULLY RESET!');
  });
