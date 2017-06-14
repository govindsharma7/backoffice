const models   = require('../src/models');
const seed     = require('../seed');
const fixtures = require('./fixtures');

// Requiring this file wipes out your db
// throw if NODE_ENV value is unexpected
if (
  process.env.NODE_ENV !== 'test' &&
  process.env.NODE_ENV !== 'development'
) {
  throw new Error('Requiring this file will erase all your data!');
}

console.log('HEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEERE');

const common = models.sequelize
  .sync()
  .then(() => {
    return fixtures({
      models,
      options: { method: 'upsert' },
    })(() => {
      return seed;
    });
  });

module.exports = () => { return fixtures({models, common}); };
