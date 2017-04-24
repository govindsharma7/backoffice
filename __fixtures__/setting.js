const models = require('../src/models');
const fixtures = require('./fixtures');

module.exports = fixtures(models)((u) => {
  return {
    Setting: [{
      id: u.id('setting-1'),
      type: 'int',
      value: 0,
    }],
  };
});
