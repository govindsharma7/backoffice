const Promise                     = require('bluebird');
const bodyParser                  = require('body-parser');
const D                           = require('date-fns');
const Liana                       = require('forest-express-sequelize');
const Aws                         = require('../../vendor/aws');
const Utils                       = require('../../utils');

module.exports = function(app, models, Apartment) {
  const LEA = Liana.ensureAuthenticated;
  let urlencodedParser = bodyParser.urlencoded({ extended: true });

  app.post('/forest/actions/send-sms', urlencodedParser, LEA, (req, res) => {
    const {values, ids} = req.body.data.attributes;

    Promise.resolve()
      .then(() => {
        if (!ids || ids.length > 1 ) {
          throw new Error('You have to select one apartment');
        }
        return models.Client.scope('currentApartment')
          .findAll({ where: { '$Rentings->Room.ApartmentId$': ids} });
      })
      .tap((clients) => {
        return Aws.sendSms(
          clients
            .map((client) => { return client.phoneNumber; })
            .filter(Boolean), // filter-out falsy values
          values.bodySms
        );
      })
      .then((clients) => {
        return res.status(200).send({
          success: `SMS successfully sent to ${clients.length} clients!`,
        });
      })
      .catch(Utils.logAndSend(res));
  });

  Utils.addInternalRelationshipRoute({
    app,
    sourceModel: Apartment,
    associatedModel: models.Client,
    routeName: 'current-clients',
    scope: 'currentApartment',
    where: (req) => {
      return {
        '$Rentings->Room.ApartmentId$': req.params.recordId,
        '$Rentings.bookingDate$': { $lte:  D.format(Date.now()) },
      };
    },
  });

  Utils.addRestoreAndDestroyRoutes(app, Apartment);
};
