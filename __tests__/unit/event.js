const fixtures = require('../../__fixtures__/renting');
const {Event}  = require('../../src/models');

var renting1;

describe('Event', () => {
  beforeAll(() => {
    return fixtures()
      .then(({instances}) => {
        return renting1 = instances['renting-1'];
      });
  });

  describe('CreateEvent', () => {
    test('it should create and event', () => {
      return Event
        .create({
        startDate: '2017-05-18 07:31:00.000 +00:00',
        endDate: '2017-05-18 07:31:00.000 +00:00',
        description: 'test',
        type: 'checkin',
        eventable: 'renting',
        eventableId: renting1.id,
        })
        .then((event) => {
        console.log(event);
          return event.getRenting();
        })
        .then((result) => {
          console.log(result);
        return true;
        });
    });
  });
});
