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

  describe('.newHouseMateSerialized', () => {
    const {newHouseMateSerialized} = Utils;
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

    test('serialized data for sendinblue', () => {
      return newHouseMateSerialized(houseMates, data)
        .then(([dataFr, dataEn, emailFr, emailEn]) => {
          expect(dataFr).toEqual(Object.assign({}, commonExpected, fr));
          expect(dataEn).toEqual(Object.assign({}, commonExpected, en));
          expect(emailFr).toEqual(['toto@gmail.com']);
          expect(emailEn.length).toEqual(0);
          return true;
        });
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
