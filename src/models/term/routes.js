const Promise       = require('bluebird');
const Liana         = require('forest-express-sequelize');
const makePublic    = require('../../middlewares/makePublic');
const Utils         = require('../../utils');

module.exports = (app, models, Term) => {
  const LEA = Liana.ensureAuthenticated;

  app.get('/forest/Term', makePublic);

  app.post('/forest/actions/update-terms', LEA, (req, res) => {
    const { roomId, apartmentId, ApartmentFeatures, RoomFeatures } = req.body;
    const features = [].concat(RoomFeatures, ApartmentFeatures);

    Promise.resolve()
      .then(() => {
        return Term.destroy({
          where: {
            $or: [{
              TermableId: roomId,
              taxonomy:  { $like: 'room-features-%' },
            }, {
              TermableId: apartmentId,
              taxonomy: { $like: 'apartment-features-%' },
            }],
          },
        });
      })
      .then(() => {
        return Term.bulkCreate(features.map(({ name, taxonomy, termable }) => {
          return {
            name,
            taxonomy,
            termable,
            TermableId: termable === 'Room' ? roomId : apartmentId,
          };
        }));
      })
      .then(Utils.createSuccessHandler(res, 'Terms'))
      .catch((e) => {
        return res.status(400).send(e);
      });
  });
};
