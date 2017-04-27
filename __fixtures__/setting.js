const fixtures = require('./index');

module.exports = fixtures((u) => {
  return {
    Setting: [{
      id: u.id('setting-1'),
      type: 'int',
      value: 0,
    }],
  };
});
