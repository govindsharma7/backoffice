const Promise                     = require('bluebird');
const Liana                       = require('forest-express-sequelize');
const { wrap }                    = require('express-promise-wrap');
const makePublic                  = require('../../middlewares/makePublic');
const Aws                         = require('../../vendor/aws');
const Utils                       = require('../../utils');

module.exports = function(app, { Apartment, Room, Client, Picture }) {
  const LEA = Liana.ensureAuthenticated;

  // The frontend needs this route to be public
  app.get('/forest/Apartment/:apartmentId', makePublic);

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

  app.post('/forest/actions/maintenance-period', LEA, (req, res) => {
    const {values, ids, collection_name: collectionName } =
      req.body.data.attributes;

    const where = collectionName === 'Apartment' ?
      { ApartmentId : { $in : ids } } :
      { id : { $in : ids} } ;

    return Room.scope('availableAt')
      .findAll({ where })
      .map((room) => room.createMaintenancePeriod(values))
      .then(Utils.createdSuccessHandler(res, 'Maintenance period'))
      .catch(Utils.logAndSend(res));
  });

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
      '$Rentings.bookingDate$': { $lte:  new Date() },
    }),
  });

  Utils.addRestoreAndDestroyRoutes(app, Apartment);
};
