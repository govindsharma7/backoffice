const Promise           = require('bluebird');
const { wrap }          = require('express-promise-wrap');
const aws               = require('./vendor/aws');
const chromeless        = require('./vendor/chromeless');
const geocode           = require('./vendor/geocode');
const payline           = require('./vendor/payline');
const sendinblue        = require('./vendor/sendinblue');
const webmerge          = require('./vendor/webmerge');
const wordpress         = require('./vendor/wordpress');
const Zapier            = require('./vendor/zapier');
const models            = require('./models');
const makePublic        = require('./middlewares/makePublic');
const { ZAPIER_API_URL } = require('./config');

module.exports = function(app) {
  // Global route used to verify that the backend is up, running and connected to
  // the DB as well as all external services
  app.get('/ping', makePublic, async (req, res) => {
    try {
      await Promise.all([
        models.Client.findOne(),
        aws.pingService(),
        geocode.pingService(),
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
    switch (req.params.scriptName) {
    case 'sendRentReminders':
      await models.Order.sendRentReminders();
      break;
    // case 'createAndSendRentInvoices':
    //   await models.Client.createAndSendRentInvoices();
    //   break;
    default:
      await Zapier.postRentReminder(1337);
      return res.send(`${ZAPIER_API_URL}/85f0oz/`);
    }

    return res.send(`${req.params.scriptName} script executed successfully`);
  }));
};
