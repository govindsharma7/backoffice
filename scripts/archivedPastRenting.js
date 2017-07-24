const subMonths = require('date-fns/sub_months');
const {
  Renting,
  Event,
  Term,
}               = require('../src/models');

const D = { subMonths };


return Renting
  .findAll({
    where: {
      '$Events.startDate$': { $lte: D.subMonths(Date.now(), 6) },
    },
    include: [{
      model: Event,
      attributes: ['id', 'startDate'],
      include: [{
        model: Term,
        attributes: [],
        where: {
          taxonomy: 'event-category',
          name: 'checkout',
        },
      }],
    }],
  })
  .map((renting) => {
    renting.destroy();
    return renting;
  });
