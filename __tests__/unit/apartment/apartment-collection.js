const D         = require('date-fns');
const fixtures  = require('../../../__fixtures__');
const models    = require('../../../src/models');

const { Apartment } = models;

describe('Apartment - Collection', () => {
  // Initialize methods in route file
  const collection = Apartment.collection(models);

  describe('→housemates', () => {
    it('should find all rooms\' current occupant or availability', async () => {
      const now = new Date();
      const oneYearAgo = D.subYears(now, 1);
      const oneMonthAgo = D.subMonths(now, 1);
      const oneMonthFromNow = D.addMonths(now, 1);

      const { unique: u } = await fixtures((u) => ({
        Apartment: [{
          id: u.id('apartment'),
          DistrictId: 'lyon-ainay',
        }],
        Room: [{
          id: u.id('room1'),
          ApartmentId: u.id('apartment'),
          reference: '1',
        }, {
          id: u.id('room2'),
          ApartmentId: u.id('apartment'),
          reference: '2',
        }, {
          id: u.id('room3'),
          ApartmentId: u.id('apartment'),
          reference: '3',
        }],
        Client: [{
          id: u.id('client1'),
          firstName: 'John',
          lastName: 'Doe',
          email: `john-${u.int(1)}@doe.something`,
        }, {
          id: u.id('client2'),
          firstName: 'Jane',
          lastName: 'Fonda',
          email: `jane-${u.int(1)}@fonda.com`,
        }, {
          id: u.id('client3'),
          firstName: 'Larry',
          lastName: 'Page',
          email: `larry-${u.int(1)}@page.com`,
        }, {
          id: u.id('client4'),
          firstName: 'Sergey',
          lastName: 'Brin',
          email: `sergey-${u.int(1)}@brin.com`,
        }],
        Renting: [{
          id: u.id('past-renting1'),
          status: 'draft',
          bookingDate: oneYearAgo,
          ClientId: u.id('client1'),
          RoomId: u.id('room1'),
        }, {
          id: u.id('current-renting'),
          status: 'active',
          bookingDate: oneMonthAgo,
          ClientId: u.id('client2'),
          RoomId: u.id('room1'),
        }, {
          id: u.id('future-renting'),
          status: 'active',
          bookingDate: oneMonthFromNow,
          ClientId: u.id('client3'),
          RoomId: u.id('room1'),
        }, {
          id: u.id('past-renting2'),
          status: 'active',
          bookingDate: oneYearAgo,
          ClientId: u.id('client4'),
          RoomId: u.id('room2'),
        }],
        Event: [{
          type: 'checkout',
          EventableId: u.id('past-renting1'),
          eventable: 'Renting',
          startDate: oneMonthAgo,
          endDate: oneMonthAgo,
        }, {
          type: 'checkout',
          EventableId: u.id('past-renting2'),
          eventable: 'Renting',
          startDate: oneMonthAgo,
          endDate: oneMonthAgo,
        }, {
          type: 'checkout',
          EventableId: u.id('current-renting'),
          eventable: 'Renting',
          startDate: oneMonthFromNow,
          endDate: oneMonthFromNow,
        }],
        Metadata: [{
          MetadatableId: u.id('client2'),
          metadatable: 'Client',
          name: 'clientIdentity',
          value: JSON.stringify({
            gender: 'female',
            birthDate: { year: '1986', month: '07', day: '23' },
            passport: 'uploads/cheznestor/123/456/',
            isStudent: true,
            nationalityEn: 'French',
            nationalityFr: 'français',
          }),
        }],
      }))();
      const housematesField =
        collection.fields.find(({ field }) => field === 'housemates');
      const actual = await housematesField.get({ id: u.id('apartment') });

      expect(actual.length).toEqual(3);
      expect(actual[0]).toMatchSnapshot();
      expect(actual[1]).toEqual([
        u.id('room2'),
        oneMonthAgo.toISOString(),
      ].join('\n'));
      expect(actual[2]).toEqual([
        u.id('room3'),
        new Date(0).toISOString(),
      ].join('\n'));
    });
  });
});
