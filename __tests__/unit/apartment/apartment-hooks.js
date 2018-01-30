const fixtures  = require('../../../__fixtures__');
const models    = require('../../../src/models');

const { Apartment } = models;

describe('Apartment - Hooks', () => {
  describe(':beforeUpdate', () => {
    it('should set the coordinates if any address field has changed', async () => {
      const { unique: u } = await fixtures((u) => ({
        Apartment: [{
          id: u.id('apartment'),
          DistrictId: 'lyon-ainay',
          addressStreet: '16 rue de Condé',
          addressZip: '69002',
          addressCountry: 'Lyon',
          status: 'draft',
        }],
      }))({ method: 'create', hooks: 'Order' });

      const actual = await Apartment.handleBeforeUpdate({
        id: u.id('apartment'),
        _changed: { addressTest: 'whatever' },
      });
      const [actualLat, actualLng] = actual.latLng.split(',').map(Number);

      expect(actualLat).toBeCloseTo(45.752, 5);
      expect(actualLng).toBeCloseTo(4.8266, 5);
    });
  });

  describe(':beforeCreate', () => {
    it('should set the coordinates if all address fields are set', async () => {
      const actual = await Apartment.handleBeforeCreate({
        addressStreet: '16 rue de Condé',
        addressZip: '69002',
        addressCountry: 'Lyon',
      });
      const [actualLat, actualLng] = actual.latLng.split(',').map(Number);

      expect(actualLat).toBeCloseTo(45.752, 5);
      expect(actualLng).toBeCloseTo(4.8266, 5);
    });
  });
});
