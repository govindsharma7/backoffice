const Promise = require('bluebird');
const Liana   = require('forest-express');
const logAndSend = require('./logAndSend');
const findOrCreateSuccessHandler = require('./findOrCreateSuccessHandler');

module.exports = function(app, Model, type) {
  const LEA = Liana.ensureAuthenticated;

  app.post(`/forest/actions/add-${type}-date`, LEA, (req, res) => {
    const {values, ids} = req.body.data.attributes;

    Promise.resolve()
    .then(() => {
      if ( !values.plannedDate ) {
        throw new Error('Please select a planned date');
      }
      if ( ids.length > 1 ) {
        throw new Error(`Can't create multiple ${type} events`);
      }

      return Model.scope('room+apartment', 'events', 'client').findById(ids[0]);
    })
    .then((renting) => {
      return renting[`findOrCreateC${type.substr(1)}`](values.plannedDate);
    })
    .then(findOrCreateSuccessHandler(res, `C${type.substr(1)} event`))
    .catch(logAndSend(res));
  });
};
