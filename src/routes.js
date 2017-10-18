const Promise           = require('bluebird');
const D                 = require('date-fns');
const aws               = require('./vendor/aws');
const geocode           = require('./vendor/geocode');
const payline           = require('./vendor/payline');
const sendinblue        = require('./vendor/sendinblue');
const webmerge          = require('./vendor/webmerge');
const config            = require('./config');
const models            = require('./models');
const makePublic        = require('./middlewares/makePublic');

module.exports = function(app) {
  // Global route used to verify that the backend is up, running and connected to
  // the DB and all external services
  app.get('/ping', makePublic, async (req, res) => {
    try {
      await Promise.all([
        models.Client.findOne(),
        aws.pingService(),
        geocode('16 rue de Condé, 69002, Lyon'),
        payline.pingService(),
        sendinblue.pingService(),
        webmerge.pingService(),
      ]);
    }
    catch (e) {
      return res.status(500).send(e);
    }

    return res.send('pong');
  });

  app.post('/forest/login', makePublic, (req, res) => {
    return Promise.resolve()
      .then(() => {
        return fetch(`${config.REST_API_URL}/forest/sessions`, {
          method: 'post',
          headers: { 'Content-Type': 'application/json' },
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
};
