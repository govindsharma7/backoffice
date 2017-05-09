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
    }, {
      id: 'rent',
      name: 'Rent',
    }, {
      id: 'pack',
      name: 'Housing Pack',
    }],
  };
})();

module.exports = fixtures({models, common});
