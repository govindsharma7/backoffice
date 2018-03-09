
const Liana      = require('forest-express-sequelize');
const { wrap }   = require('express-promise-wrap');

const LEA = Liana.ensureAuthenticated;
const Serializer = Liana.ResourceSerializer;

module.exports = function({app, sourceModel, associatedModel, routeName, where}) {
  const route = `/forest/${sourceModel.name}/:recordId/relationships/${routeName}`;

  return app.get(route, LEA, wrap(async (req, res) => {
    const records = await associatedModel.findAll(where && { where: where(req) });

    const serialized = await new Serializer(Liana, associatedModel, records, {}, {
      count: records.length,
    }).perform();

    res.send(serialized);
  }));
};
