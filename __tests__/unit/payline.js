const Promise       = require('bluebird');
const payline       = require('../../src/vendor/payline');

describe('Payline', () => {
  describe('.pay', () => {
    const paylineError = new Error();

    paylineError.longMessage = 'payline error';
    paylineError.code = '01100';

    const mockedDoPurchase = jest.spyOn(payline.payline, 'doPurchase')
      .mockImplementation(() => Promise.reject(paylineError));

    afterAll(() => {
      mockedDoPurchase.mockRestore();
    });

    it('should convert a payline error to a CNError', async () => {
      let actual;

      try {
        await payline.doPurchase();
      }
      catch (e) {
        actual = e;
      }

      expect(actual.name).toEqual('CNError');
      expect(actual.message).toEqual('payline error');
      expect(actual.code).toEqual('payment.doNotHonor');

      return true;
    });
  });
});
