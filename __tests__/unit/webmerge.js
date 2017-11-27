const D                  = require('date-fns');
const webmerge           = require('../../src/vendor/webmerge');
const Utils              = require('../../src/utils');
const { DEPOSIT_PRICES } = require('../../src/const');

describe('webmerge', () => {
  describe('.webmergeSerialize', () => {
    const commonArgs = {
      renting: {
        price: 60000,
        serviceFees : 4000,
        bookingDate: undefined,
      },
      client: {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John DOE',
        email: 'john@doe.com',
      },
      room: {
        reference: '216CON03',
        floorArea: 15,
      },
      apartment: {
        name: '16 Condé',
        addressStreet: '16 rue Condé',
        addressCity: 'lyon',
        addressZip: '69002',
        floor: 0,
        floorArea: 47,
      },
      depositTerm: false,
      identityMeta: {
        value: JSON.stringify({
          address: {
            1: '16 rue Conde',
            2: 'Lyon',
            3: undefined,
            4: '69002',
          },
          birthDate: {
            day: '23',
            month: '07',
            year: '1986',
          },
          birthPlace: {
            first: 'New York',
            last: 'United States',
          },
          birthCountryFr: 'Etats-Unis',
          nationalityFr: 'américain',
        }),
      },
      comfortLevel: 'basique',
    };
    const now = new Date();
    const commonExpected = {
      fullName: 'John DOE',
      fullAddress: '16 rue Conde, Lyon, 69002',
      birthDate: '23/07/1986',
      birthPlace: 'New York (Etats-unis)',
      nationality: 'américain',
      rent: 600,
      serviceFees: 40,
      deposit: DEPOSIT_PRICES.lyon / 100,
      depositOption: 'd\'encaissement du montant',
      packLevel: 'Basique',
      roomNumber: 'la chambre privée nº3',
      roomFloorArea: 15,
      floorArea: 47,
      address: '16 rue Condé, Lyon, 69002',
      floor: 'rez-de-chausée',
      bookingDate: D.format(now, 'DD/MM/YYYY'),
      endDate: D.format(Utils.getLeaseEndDate(now), 'DD/MM/YYYY'),
      email: 'john@doe.com',
    };

    test('it serializes data for webmerge', () => {
      const actual = webmerge.serializeLease(commonArgs);

      return expect(actual).toEqual(commonExpected);
    });

    test('it serializes data for webmerge', () => {
      const bookingDate = D.parse('2017-05-14 Z');
      const args = Object.assign({}, commonArgs, {
        renting: Object.assign({}, commonArgs.renting, { bookingDate }),
        room: {
          reference: '216CON0',
          floorArea: 15,
        },
        apartment: {
          name: '16 Condé studio',
          addressStreet: '16 rue Condé',
          addressCity: 'lyon',
          addressZip: '69002',
          floor: 4,
          floorArea: 15,
        },
        depositTerm: {
          taxonomy: 'deposit-option',
          name: 'do-not-cash',
        },
        comfortLevel: 'privilege',
      });
      const expected = Object.assign({}, commonExpected, {
        packLevel: 'Privilège',
        floorArea: 15,
        floor: 4,
        roomNumber: 'l\'appartement entier',
        depositOption: 'de non encaissement du chèque',
        bookingDate: D.format(bookingDate, 'DD/MM/YYYY'),
        endDate: D.format(Utils.getLeaseEndDate(bookingDate), 'DD/MM/YYYY'),
      });
      const actual = webmerge.serializeLease(args);

      return expect(actual).toEqual(expected);
    });
  });
});
