const fixtures = require('../../__fixtures__/setting');

var setting;

describe('Setting', () => {
  beforeAll(() => {
    return fixtures()
      .then(({instances}) => {
        return setting = instances['setting-1'];
      });
  });

  describe('type \'int\'', () => {
    test('it should set and get integer values', () => {
      expect(setting.value).toEqual(setting.intVal);
    });

    test('it should be able to increment the value', () => {
      const prevVal = setting.value;

      return setting.increment('value')
        .then((setting) => {
          return setting.reload();
        })
        .then((setting) => {
          return expect(setting.value).toEqual(prevVal + 1);
        });
    });
  });
});
