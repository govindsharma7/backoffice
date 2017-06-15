const Promise = require('bluebird');
const models  = require('../src/models');

return models.Apartment.scope('_roomCount')
  .findAll()
  .tap((apartments) => {
    return Promise.map(apartments, (apartment) => {
      return apartment.roomCount == null ?
        apartment.update({
          roomCount: apartment.get('_roomCount'),
        }) :
        apartment;
    });
  })
  .then((apartments) => {
    return console.log(`Fixed ${apartments.length} apartments`);
  });
