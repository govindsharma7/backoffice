const models   = require('../src/models');
const seed     = require('../seed');
const fixtures = require('./fixtures');

const common = fixtures({
  models,
  options: { method: 'upsert' },
})(() => {
  return seed;
})();

module.exports = fixtures({models, common});
