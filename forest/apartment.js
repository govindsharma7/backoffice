const Liana = require('forest-express-sequelize');
const {TRASH_SEGMENTS} = require('../src/const');

Liana.collection('Apartment', {
  segments: TRASH_SEGMENTS.concat([{
    name: 'Lyon',
    scope: 'lyon',
  }, {
    name: 'Montpellier',
    scope: 'montpellier',
  }, {
    name: 'Paris',
    scope: 'paris',
  }]),
  fields: [{
    field: 'currentClients',
    type: ['String'],
    reference: 'Client.id',
  }],
});
