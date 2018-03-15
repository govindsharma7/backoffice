const Promise             = require('bluebird');
const Liana               = require('forest-express-sequelize');
const Op                  = require('../operators');
const logAndSend          = require('./logAndSend');
const {
  restoreSuccessHandler,
  destroySuccessHandler,
}                         = require('./destroyAndRestoreSuccessHandler');

function restore(instances) {
  return Promise.all(
    instances
      .filter((instance) => instance.deletedAt != null )
      .map((instance) => instance.set('status', 'active').restore())
  )
  .then((filterInstances) => filterInstances.length);
}

function destroy(instances) {
  return Promise.all(
    instances
      .filter((instance) => instance.deletedAt != null)
      .map((instance) => instance.destroy({force: true}))
  )
  .then((filterInstances) => filterInstances.length);
}

module.exports = function(app, Model) {
  const LEA = Liana.ensureAuthenticated;
  const name = Model.name.toLocaleLowerCase();

  app.post(`/forest/actions/restore-${name}`, LEA, (req, res) => {
    Model
      .findAll({
        where: { id: { [Op.in]: req.body.data.attributes.ids } },
        paranoid: false,
      })
      .then((instances) => restore(instances))
      .then((value) => restoreSuccessHandler(res, `${value} ${Model.name}s`))
      .catch(logAndSend(res));
  });

  app.post(`/forest/actions/destroy-${name}`, LEA, (req, res) => {
    Model
      .findAll({
        where: { id: { [Op.in]: req.body.data.attributes.ids } },
        paranoid: false,
      })
      .then((instances) => destroy(instances))
      .then((value) => destroySuccessHandler(res, `${value} ${Model.name}s`))
      .catch(logAndSend(res));
  });
};
