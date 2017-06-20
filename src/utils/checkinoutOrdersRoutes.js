const Promise = require('bluebird');
const Liana   = require('forest-express');
const logAndSend = require('./logAndSend');
const findOrCreateSuccessHandler = require('./findOrCreateSuccessHandler');

module.exports = function(app, Model, type) {
  const LEA = Liana.ensureAuthenticated;

  app.post(`/forest/actions/create-${type}-order`, LEA, (req, res) => {
      const {ids} = req.body.data.attributes;

      Promise.resolve()
      .then(() => {
        if ( ids.length > 1 ) {
          throw new Error('Can\'t create multiple checkout orders');
        }
        return Model
                .scope('events', 'room+apartment', `${type}Date`, 'client', 'orderItems')
                .findById(ids[0]);
      })
      .then((renting) => {
        if ( !renting.get(`${type}Date`) || !renting.getComfortLevel() ) {
          throw new Error(
            `C${type.substr(1)} and housing pack are required to create checkout order`
          );
        }
        return renting[`findOrCreateC${type.substr(1)}Order`]();
      })
      .then(findOrCreateSuccessHandler(res, `C${type.substr(1)} order`))
      .catch(logAndSend(res));
    });
};
