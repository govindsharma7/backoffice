const Liana      = require('forest-express-sequelize');
const logAndSend = require('./logAndSend');

const LEA = Liana.ensureAuthenticated;
const Serializer = Liana.ResourceSerializer;

module.exports = function({app, sourceModel, associatedModel, routeName, scope, where}) {
  return app.get(
    `/forest/${sourceModel.name}/:recordId/relationships/${routeName}`,
    LEA,
    (req, res) => {
      associatedModel.scope(scope)
        .findAll(where && { where: where(req) })
        .then((records) => {
          return new Serializer(Liana, associatedModel, records, {}, {
            count: records.length,
          }).perform();
        })
        .then((result) => {
          return res.send(result);
        })
        .catch(logAndSend(res));
    });
};
