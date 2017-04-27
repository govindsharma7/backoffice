const models = require('../src/models');
const fixtures = require('./fixtures');

const common = fixtures({
  models,
  options: { method: 'upsert' },
})(() => {
  return {
    Setting: [{
      id: 'invoice-counter',
      type: 'int',
      value: 0,
    }],
    Product: [{
      id: 'service-fees',
      name: 'Service Fees',
    }],
  };
})();

module.exports = fixtures({models, common});
