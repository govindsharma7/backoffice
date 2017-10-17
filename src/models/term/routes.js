const D             = require('date-fns');
const Promise       = require('bluebird');
const Liana         = require('forest-express-sequelize');
const makePublic    = require('../../middlewares/makePublic');
const fetch         = require('../../vendor/fetch');
const config        = require('../../config');
const Utils         = require('../../utils');

module.exports = (app, models, Term) => {
  const LEA = Liana.ensureAuthenticated;

  app.get('/forest/Term', makePublic);

  app.post('/forest/amIAdmin', makePublic, (req, res) => {
    return Promise.resolve()
      .then(() => {
        return fetch(`${config.REST_API_URL}/forest/sessions`, {
          method: 'POST',
          body: JSON.stringify(Object.assign(
            {},
            req.body,
            { renderingId: config.FOREST_RENDERING_ID }
          )),
        });
      })
      .then((response) => {
        if ( !response.ok ) {
          /* eslint-disable promise/no-nesting */
          return response.text()
            .then((message) => {
              throw new Error(message);
            });
          /* eslint-enable promise/no-nesting */
        }
        return response.json();
      })
      .then((result) => {
        return res.cookie(
          'authorized',
          `Bearer ${result.token}`,
          { expires: D.addDays(Date.now(), 30) }
        ).send(result);
      })
      .catch((e) => {
        return res.status(400).send(e);
      });
  });

  app.post('/forest/actions/public/updateTerms', LEA, (req, res) => {
    const { roomId, apartmentId, ApartmentFeatures, RoomFeatures } = req.body;

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
        return Promise.all([
          RoomFeatures.map(({name, taxonomy, termable }) => {
            return Term.create({
              name,
              taxonomy,
              termable,
              TermableId: roomId,
            });
          }),
          ApartmentFeatures.map(({name, taxonomy, termable }) => {
            return Term.create({
              name,
              taxonomy,
              termable,
              TermableId: apartmentId,
            });
          }),
        ]);
      })
      .then(Utils.createSuccessHandler(res, 'Terms'))
      .catch((e) => {
        return res.status(400).send(e);
      });
  });
};
