const app               = require('express')();
const D                 = require('date-fns');
const models            = require('../../../src/models');
const Utils             = require('../../../src/utils');
const fixtures          = require('../../../__fixtures__');
const Sendinblue        = require('../../../src/vendor/sendinblue');

const { Client } = models;

describe('Client - Routes', () => {
  // Initialize methods in route file
  Client.routes(app, models);

  describe('client-identity', () => {
    it('updates client and Sendinblue contact + normalizes metadata', async () => {
      const spiedUpdateContact = jest.spyOn(Sendinblue.ContactsApi, 'updateContact');

      const { unique: u } = await fixtures((u) => ({
        Apartment: [{
          id: u.id('apartment'),
          addressCity: 'lyon',
          DistrictId: 'lyon-ainay',
        }],
        Room: [{
          id: u.id('room'),
          ApartmentId: u.id('apartment'),
        }],
        Client: [{
          id: u.id('client'),
          firstName: 'John',
          lastName: 'Doe',
          email: `${u.id('client')}@test.com`,
          phoneNumber: '0033612345678',
          preferredLanguage: 'fr',
        }],
        Renting: [{
          id: u.id('renting'),
          ClientId: u.id('client'),
          RoomId: u.id('room'),
          status: 'active',
          bookingDate: D.parse('2016-01-01'),
        }],
      }))();

      await Client.handleClientIdentityRoute({
        'q01_clientId': `${u.id('client')}@test.com`,
        'q02_fullName': {
          first: 'Johny',
          last: 'Doey',
        },
        'q04_phoneNumber': {
          phone: '0698765432',
          area: '+33',
        },
        'q05_preferredLanguage': 'en',
        'q06_nationality': 'United States',
        'q07_birthPlace': { last: 'England' },
        'q08_frenchStatus': 'Intern',
        'q09_something': 'else',
      });

      const client = await Client.scope('clientMeta').findById(u.id('client'));
      const identity = JSON.parse(client.identityRecord);

      expect(client.firstName).toEqual('Johny');
      expect(client.lastName).toEqual('Doey');
      expect(client.preferredLanguage).toEqual('en');
      expect(client.Metadata.length).toEqual(1);
      expect(client.phoneNumber).toEqual('+33698765432');
      expect(identity.countryEn).toEqual('United States');
      expect(identity.countryFr).toEqual('États-Unis');
      expect(identity.nationalityEn).toEqual('American');
      expect(identity.nationalityFr).toEqual('américain');
      expect(identity.birthCountryEn).toEqual('England');
      expect(identity.birthCountryFr).toEqual('Angleterre');
      expect(identity.frenchStatus).toEqual('Intern');
      expect(identity.isStudent).toEqual(true);
      expect(identity.something).toEqual('else');
      expect(Utils.snapshotableLastCall(spiedUpdateContact))
        .toMatchSnapshot();
    });
  });
});
