const Promise = require('bluebird');

module.exports.restore = function(instances) {
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
};

module.exports.destroy = function(instances) {
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
};
