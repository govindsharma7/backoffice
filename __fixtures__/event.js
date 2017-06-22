 const fixtures = require('./index');

module.exports = fixtures((u) => {
  return {
    Event: [{
      id: u.id('event-1'),
      summary: 'checkout',
      startDate: '2016-02-03',
      endDate: '2016-02-03',
      eventable: 'Renting',
      EventableId: u.id('renting-1'),
    }, {
      id: u.id('event-2'),
      summary: 'OtherEvent',
      startDate: '2017-02-10',
      endDate: '2017-02-10',
      eventable: 'Renting',
      EventableId: u.id('renting-2'),
    }],
    Term: [{
      name: 'checkout',
      taxonomy: 'event-category',
      termable: 'Event',
      TermableId: u.id('event-1'),
    }],
  };
});
