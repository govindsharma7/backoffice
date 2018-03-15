const D     = require('date-fns');
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
      expect(getPeriodPrice(96900, 1, 4000)).toEqual(95800);
      expect(getPeriodPrice(100900, 1, 4000)).toEqual(99800);
    });
  });

  describe('.serializeHousemate', () => {
    const {serializeHousemate} = Utils;
    const data = JSON.stringify({
      checkinDate: {
        day: '04',
        month: 12,
        year: 2018,
      },
      fullName: {
        first: 'John',
      },
      email: 'john.doe@gmail.com',
      nationalityFr: 'Americain',
      nationalityEn: 'American',
      isStudent: false,
    });
    const houseMates = [{
      email: 'toto@gmail.com',
      preferredLanguage: 'fr',
      Rentings: [{
        Room: {
          Apartment: {
            addressCity: 'montpellier',
          },
        },
      }],
    }];
    const commonExpected = {
      FIRSTNAME: 'John',
      CITY: 'montpellier',
      ARRIVAL: '04/12/2018',
      EMAIL: 'john.doe@gmail.com',
    };
    const fr = {
      COUNTRY: 'Americain',
      WORK: 'travailler',
    };
    const en = {
      COUNTRY: 'American',
      WORK: 'work',
    };

    test('serialized data for sendinblue', async () => {
      const [dataFr, dataEn, emailFr, emailEn] =
        await serializeHousemate(houseMates, data);

      expect(dataFr).toEqual(Object.assign({}, commonExpected, fr));
      expect(dataEn).toEqual(Object.assign({}, commonExpected, en));
      expect(emailFr).toEqual(['toto@gmail.com']);
      expect(emailEn.length).toEqual(0);
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

  describe('.prorate()', () => {
    const price = 20000;
    const serviceFees = 3000;

    test('it calculates the prorata for the "booking month"', () => {
      const actual = Utils.prorate({
        price,
        serviceFees,
        bookingDate: D.parse('2015-01-20'),
        checkoutDate: null,
        date: D.parse('2015-01 Z'),
      });
      const expected = {
        price: Utils.roundBy100(price / 31 * (31 - (20 - 1))),
        serviceFees: Utils.roundBy100(serviceFees / 31 * (31 - (20 - 1))),
      };

      return expect(actual).toEqual(expected);
    });

    test('it calculates the prorata for "checkout month"', () => {
      const actual = Utils.prorate({
        price,
        serviceFees,
        bookingDate: D.parse('2015-01-20'),
        checkoutDate: D.parse('2015-02-10'),
        date: D.parse('2015-02 Z'),
      });
      const expected = {
        price: Utils.roundBy100(price / 28 * 10),
        serviceFees: Utils.roundBy100(serviceFees / 28 * 10),
      };

      return expect(actual).toEqual(expected);
    });

    test('it calculates the prorata for "booking+checkout month"', () => {
      const actual = Utils.prorate({
        price,
        serviceFees,
        bookingDate: D.parse('2015-03-03'),
        checkoutDate: D.parse('2015-03-28'),
        date: D.parse('2015-03 Z'),
      });
      const expected = {
        price: Utils.roundBy100(price / 31 * (28 - 2)),
        serviceFees: Utils.roundBy100(serviceFees / 31 * (28 - 2)),
      };

      return expect(actual).toEqual(expected);
    });

    test('it bills a full month when checkout is the last day of the month', () => {
      const actual = Utils.prorate({
        price,
        serviceFees,
        bookingDate: D.parse('2015-01-01'),
        checkoutDate: D.parse('2015-03-31'),
        date: D.parse('2015-03 Z'),
      });
      const expected = {
        price: Utils.roundBy100(price),
        serviceFees: Utils.roundBy100(serviceFees),
      };

      return expect(actual).toEqual(expected);
    });

    test('it bills a single day when checkout is the first day of the month', () => {
      const actual = Utils.prorate({
        price,
        serviceFees,
        bookingDate: D.parse('2015-01-01'),
        checkoutDate: D.parse('2015-03-01'),
        date: D.parse('2015-03 Z'),
      });
      const expected = {
        price: Utils.roundBy100(price / 31),
        serviceFees: Utils.roundBy100(serviceFees / 31),
      };

      return expect(actual).toEqual(expected);
    });

    test('it bills a single day when booking is the last day of the month', () => {
      const actual = Utils.prorate({
        price,
        serviceFees,
        bookingDate: D.parse('2015-01-31'),
        checkoutDate: null,
        date: D.parse('2015-01 Z'),
      });
      const expected = {
        price: Utils.roundBy100(price / 31),
        serviceFees: Utils.roundBy100(serviceFees / 31),
      };

      return expect(actual).toEqual(expected);
    });
  });
});
