const Liana = require('forest-express-sequelize');
const {TRASH_SEGMENTS} = require('../src/const');

Liana.collection('Credit', {
  actions: [{
    name: 'Restore Credit',
  }, {
    name: 'Destroy Credit',
  }],
  segments: TRASH_SEGMENTS,
});
