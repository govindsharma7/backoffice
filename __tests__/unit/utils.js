const Utils = require('../../src/utils');

describe('Utils', () => {
  describe('.getPeriodPrice', () => {
    const {getPeriodPrice} = Utils;

    test('it correctly rounds prices', () => {
      expect(getPeriodPrice(19900, 1, 3000)).toEqual(19800);
      expect(getPeriodPrice(20900, 1, 3000)).toEqual(19800);
      expect(getPeriodPrice(19900, 1, 4000)).toEqual(19800);
      expect(getPeriodPrice(20900, 1, 4000)).toEqual(19800);
      expect(getPeriodPrice(16900, 1, 3000)).toEqual(16800);
      expect(getPeriodPrice(17900, 1, 3000)).toEqual(16800);
      expect(getPeriodPrice(15900, 1, 4000)).toEqual(15800);
      expect(getPeriodPrice(16900, 1, 4000)).toEqual(15800);
    });
  });

  describe('.toSingleLine', () => {
    const {toSingleLine} = Utils;

    test('it converts any (sequence of) spacing character to a single space', () => {
      expect(toSingleLine('\rA  B\tC\n')).toEqual('A B C');
      expect(toSingleLine(`
        A
        B
        C
      `)).toEqual('A B C');
    });
  });
});
