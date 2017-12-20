const makePublic       = require('../../middlewares/makePublic');

module.exports = function(app) {
  app.get('/forest/District/:districtId', makePublic);
};
