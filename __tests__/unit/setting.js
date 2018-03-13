const fixtures = require('../../__fixtures__/');

describe('Setting', () => {

  describe('type \'int\'', () => {
    let setting;

    beforeAll(async () => {
      const { instances } = await fixtures((u) => ({
        Setting: [{
          id: u.id('setting'),
          type: 'int',
          value: 0,
        }],
      }))();

      setting = instances.setting;
    });

    test('it should set and get integer values', () => {
      expect(setting.value).toEqual(setting.intVal);
    });

    test('it should be able to increment the value', async () => {
      const prevVal = setting.value;

      await setting.increment();

      const _setting = await setting.reload();

      expect(_setting.value).toEqual(prevVal + 1);
    });
  });
});
