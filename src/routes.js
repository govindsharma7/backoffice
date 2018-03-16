const Promise           = require('bluebird');
const _                 = require('lodash');
const { wrap }          = require('express-promise-wrap');
const aws               = require('./vendor/aws');
const chromeless        = require('./vendor/chromeless');
const gmaps             = require('./vendor/gmaps');
const payline           = require('./vendor/payline');
const sendinblue        = require('./vendor/sendinblue');
const webmerge          = require('./vendor/webmerge');
const wordpress         = require('./vendor/wordpress');
const Zapier            = require('./vendor/zapier');
const models            = require('./models');
const makePublic        = require('./middlewares/makePublic');

module.exports = function(app) {
  // Global route used to verify that the backend is up, running and connected to
  // the DB as well as all external services
  app.get('/ping', makePublic, async (req, res) => {
    try {
      await Promise.all([
        models.Client.findOne(),
        aws.pingService(),
        gmaps.pingService(),
        payline.pingService(),
        sendinblue.pingService(),
        webmerge.pingService(),
        chromeless.pingService(),
        wordpress.pingService(),
      ]);
    }
    catch (e) {
      return res.status(500).send(e);
    }

    return res.send('pong');
  });

  // Global route used to execute one of the scripts remotely
  app.get('/script/:scriptName', makePublic, wrap(async (req, res) => {
    let orders;
    let rentings;
    const postSuccess = _.curry(Zapier.post, 2)('85f0oz');

    switch (req.params.scriptName) {
    case 'sendRentReminders':
      orders = await models.Order.sendRentReminders();

      await postSuccess({
        messageType: 'rent reminders',
        count: orders.length,
      });
      break;

    case 'createAndSendRentInvoices':
      orders = await models.Client.createAndSendRentInvoices();

      await postSuccess({
        messageType: 'rent invoices',
        count: orders.length,
      });
      break;

    case 'updateDraftRentings':
      rentings = await models.Renting.updateDraftRentings();

      await sendinblue.sendAdminNotif(`${rentings.length} rentings have been updated.`);
      break;

    default:
      await postSuccess({ messageType: 'test', count: 1 });
      break;
    }

    return res.send(`${req.params.scriptName} script executed successfully`);
  }));
};
