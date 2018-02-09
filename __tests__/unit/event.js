const models           = require('../../src/models');
const fixtures         = require('../../__fixtures__/');

describe('Event', () => {
  describe('Scopes', () => {
    test('event-category scope should return Event\'s type', async () => {
      const { unique: u } = await fixtures((u) => ({
        Event: [{
          id: u.id('event'),
          summary: 'any summary',
          startDate: '2016-02-03',
          endDate: '2016-02-03',
          eventable: 'Renting',
          EventableId: 'any-id',
          type: 'checkout',
        }],
        Term: [{
          name: 'checkout',
          taxonomy: 'event-category',
          termable: 'Event',
          TermableId: u.id('event'),
        }],
      }))({ method: 'create', hooks: false });

      const event =
        await models.Event.scope('event-category').findById(u.id('event'));

      expect(event.get('category')).toEqual('checkout');
    });
  });
});
