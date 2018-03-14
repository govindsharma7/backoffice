jest.mock('../../../src/vendor/gmaps');

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

      // geocode is auto-mocked to "16 rue de Condé"'s coordinates
      expect(actualLat).toEqual(45.752021);
      expect(actualLng).toEqual(4.826661);
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

      // geocode is auto-mocked to "16 rue de Condé"'s coordinates
      expect(actualLat).toEqual(45.752021);
      expect(actualLng).toEqual(4.826661);
      expect(actual.descriptionFr.length).toBeGreaterThan(100);
      expect(actual.descriptionEn.length).toBeGreaterThan(100);
    });
  });
});
