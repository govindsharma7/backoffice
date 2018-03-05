const Promise                     = require('bluebird');
const Liana                       = require('forest-express-sequelize');
const { wrap }                    = require('express-promise-wrap');
const Op                          = require('../../operators');
const Aws                         = require('../../vendor/aws');
const Utils                       = require('../../utils');

module.exports = function(app, { Apartment, Room, Client, Picture }) {
  const LEA = Liana.ensureAuthenticated;

  // TODO: re-implement this route using Sendinblue API
  app.post('/forest/actions/send-sms', LEA, (req, res) => {
    const {values, ids} = req.body.data.attributes;

    Promise.resolve()
      .then(() => {
        if (!ids || ids.length > 1 ) {
          throw new Error('You have to select one apartment');
        }
        return Client.scope('currentApartment')
          .findAll({ where: { '$Rentings->Room.ApartmentId$': ids} });
      })
      .tap((clients) => Aws.sendSms(
        clients
          .map((client) => client.phoneNumber)
          .filter(Boolean), // filter-out falsy values
        values.bodySms
      ))
      .then((clients) => res.status(200).send({
        success: `SMS successfully sent to ${clients.length} clients!`,
      }))
      .catch(Utils.logAndSend(res));
  });

  Apartment.handleMaintenancePeriodRoute = function(attributes) {
    const { values, ids, collection_name: collectionName } = attributes;

    const where = collectionName === 'Apartment' ?
      { ApartmentId : { $in : ids } } :
      { id : { $in : ids } } ;

    return Room.scope('availableAt')
      .findAll({ where })
      .map((room) => room.createMaintenancePeriod(values));
  };
  app.post('/forest/actions/maintenance-period', LEA, wrap(async (req, res) => {
    const result =
      await Apartment.handleMaintenancePeriodRoute(req.body.data.attributes);

    Utils.createdSuccessHandler(res, 'Maintenance period')(result);
  }));

  app.post('/forest/actions/import-drive-pics', LEA, wrap(async (req, res) => {
    const { values, ids, collection_name: collectionName } =
      req.body.data.attributes;

    if ( !ids || ids.length > 1 ) {
      throw new Error(`You have to select one ${collectionName.toLowerCase()}`);
    }

    const pics =
      values.urls
        .split('https://')
        .filter(Boolean)
        .map((url) => ({
          picturable: collectionName,
          PicturableId: ids[0],
          url: `https://${url.trim()}`,
        }));

    await Picture.bulkCreate(pics);

    Utils.createdSuccessHandler(res, 'pictures')(pics);
  }));

  Utils.addInternalRelationshipRoute({
    app,
    sourceModel: Apartment,
    associatedModel: Client,
    routeName: 'current-clients',
    scope: 'currentApartment',
    where: (req) => ({
      '$Rentings->Room.ApartmentId$': req.params.recordId,
      '$Rentings.bookingDate$': { [Op.lte]:  new Date() },
    }),
  });

  Utils.addRestoreAndDestroyRoutes(app, Apartment);
};
