const Liana            = require('forest-express-sequelize');
const makePublic       = require('../../middlewares/makePublic');

module.exports = function(app, models, Room) {
  const LEA = Liana.ensureAuthenticated;

  app.get('/forest/District', (req, res, next) => {
    return (
      req.query.filterType === 'and' &&
      /DistrictId/.test(Object.keys(req.query.filter).join(''))
    ) ?
      makePublic(req, res, next) :
      LEA(req, res, next);
  });
};
