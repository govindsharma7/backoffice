const fixtures  = require('../../../__fixtures__');
const models    = require('../../../src/models');

const { Apartment } = models;

describe('Apartment - Hooks', () => {
  describe(':beforeUpdate', () => {
    it('should set the coordinates if any address field has changed', async () => {
      const { instances: { apartment } } = await fixtures((u) => ({
        Apartment: [{
          id: u.id('apartment'),
          DistrictId: 'lyon-ainay',
          addressStreet: '16 rue de Condé',
          addressZip: '69002',
          addressCity: 'lyon',
          addressCountry: 'France',
        }],
      }))();
      const actual = await apartment.update({ addressStreet: '20 rue de Condé' });
      const [actualLat, actualLng] = actual.latLng.split(',').map(Number);

      expect(actualLat).toBeCloseTo(45.75191, 5);
      expect(actualLng).toBeCloseTo(4.82686, 5);
    });
  });

  describe(':beforeCreate', () => {
    it('should set the coordinates if all address fields are set', async () => {
      await fixtures(() => ({}))();

      const actual = await Apartment.create({
        DistrictId: 'lyon-ainay',
        addressStreet: '16 rue de Condé',
        addressZip: '69002',
        addressCity: 'lyon',
        addressCountry: 'France',
      });
      const [actualLat, actualLng] = actual.latLng.split(',').map(Number);

      expect(actualLat).toBeCloseTo(45.752, 5);
      expect(actualLng).toBeCloseTo(4.8266, 5);
      expect(actual.descriptionFr.length).toBeGreaterThan(100);
      expect(actual.descriptionEn.length).toBeGreaterThan(100);
    });
  });
});
