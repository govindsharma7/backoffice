jest.mock('../../../src/vendor/gmaps');

const models = require('../../../src/models');

const { Apartment } = models;

describe('Apartment - Model', () => {
  describe('.calculateLatLng', () => {
    it('should calculate the coordinates from the address fields', async () => {
      const actual = await Apartment.calculateLatLng({ apartment: {
        addressStreet: '16 rue de Condé',
        addressZip: '69002',
        addressCountry: 'france',
      } });
      const [actualLat, actualLng] = actual.split(',').map(Number);

      // geocode is auto-mocked to "16 rue de Condé"'s coordinates
      expect(actualLat).toEqual(45.752021);
      expect(actualLng).toEqual(4.826661);
    });
  });
});
