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

      expect(actualLat).toBeCloseTo(45.752, 5);
      expect(actualLng).toBeCloseTo(4.8266, 5);
    });
  });
});
