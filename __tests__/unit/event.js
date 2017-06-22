const models           = require('../../src/models');
const fixtures         = require('../../__fixtures__/event');

var event;
var event2;

describe('Event', () => {
  beforeAll(() => {
    return fixtures()
      .then(({instances}) => {
        return (
          event = instances['event-1'],
          event2 = instances['event-2']
        );
      });
  });

  describe('Scopes', () => {
    test('event-category scope should return Event\'s category(term)', () => {
      return models.Event.scope('event-category')
        .findById(event.id)
        .then((event) => {
          return expect(event.get('category')).toEqual('checkout');
      });
    });
    test('event-category scope should return null if there is no Term', () => {
      return models.Event.scope('event-category')
        .findById(event2.id)
        .then((event) => {
          return expect(event.get('category')).toBeNull();
      });
    });
  });
});
