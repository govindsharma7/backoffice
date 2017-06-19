const Promise             = require('bluebird');
const Liana               = require('forest-express-sequelize');
const logAndSend          = require('./logAndSend');
const {
  restoreSuccessHandler,
  destroySuccessHandler,
}                         = require('./destroyAndRestoreSuccessHandler');

function restore(instances) {
  return Promise.all(
    instances
      .filter((instance) => {
        return instance.deletedAt != null;
      })
      .map((instance) => {
          return instance.restore();
      })
  )
  .then((filterInstances) => {
    return filterInstances.length;
  });
}

function destroy(instances) {
  return Promise.all(
    instances
      .filter((instance) => {
        return instance.deletedAt != null;
      })
      .map((instance) => {
        return instance.destroy({force: true});
      })
  )
  .then((filterInstances) => {
    return filterInstances.length;
  });
}

module.exports = function(app, Model) {
  const LEA = Liana.ensureAuthenticated;
  const name = Model.name.toLocaleLowerCase();

  app.post(`/forest/actions/restore-${name}`, LEA, (req, res) => {
    Model
      .findAll({
        where: { id: { $in: req.body.data.attributes.ids } },
        paranoid: false,
      })
      .then((instances) => {
        return restore(instances);
      })
      .then((value) => {
        return restoreSuccessHandler(res, `${value} ${Model.name}s`);
      })
      .catch(logAndSend(res));
  });

  app.post(`/forest/actions/destroy-${name}`, LEA, (req, res) => {
    Model
      .findAll({
        where: { id: { $in: req.body.data.attributes.ids } },
        paranoid: false,
      })
      .then((instances) => {
        return destroy(instances);
      })
      .then((value) => {
        return destroySuccessHandler(res, `${value} ${Model.name}s`);
      })
      .catch(logAndSend(res));
  });
};
