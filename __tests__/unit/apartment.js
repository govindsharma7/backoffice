//const D         = require('date-fns');
//const Promise   = require('bluebird');
const fixtures    = require('../../__fixtures__/apartment');
//const Utils     = require('../../src/utils');
const models      = require('../../src/models');

const {Apartment} = models;
var apartment1;
var client1;
var client2;

describe('Apartment', () => {
  beforeAll(() => {
    return fixtures()
      .then(({instances}) => {
        return (
          apartment1 = instances['apartment-1'],
          client1 = instances['client-1'],
          client2 = instances['client-2']
        );
      });
  });

  describe('scopes', () => {
    test('currentClient scope Should return all current clients for an apartment', () => {
      return Apartment.scope('currentClients')
        .findById(apartment1.id)
        .then((apartment) => {
          expect(apartment.Rooms[0].Rentings[0].Client.id)
            .toEqual(client1.id);
          expect(apartment.Rooms[1].Rentings[0].Client.id)
            .toEqual(client2.id);
          return true;
        });
    });

  });

  describe('#getCurrentClientsPhoneNumbers()', () => {
    test('it should return all current clients phone numbers', () => {
      return Apartment.scope('currentClients')
        .findById(apartment1.id)
        .then((apartment) => {
          return apartment.getCurrentClientsPhoneNumbers();
        })
        .then((phoneNumbers) => {
          expect(phoneNumbers[0]).toEqual(client1.phoneNumber);
          expect(phoneNumbers[1]).toEqual(client2.phoneNumber);
          return true;
        });
    });
  });
});
