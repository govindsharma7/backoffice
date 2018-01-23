const makePublic    = require('../../middlewares/makePublic');

module.exports = (app) => {
  app.get('/forest/Term', makePublic);
};
