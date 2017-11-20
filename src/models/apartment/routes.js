const Promise                     = require('bluebird');
const bodyParser                  = require('body-parser');
const Liana                       = require('forest-express-sequelize');
const makePublic                  = require('../../middlewares/makePublic');
const Aws                         = require('../../vendor/aws');
const Utils                       = require('../../utils');

module.exports = function(app, { Apartment, Room, Client }) {
  const LEA = Liana.ensureAuthenticated;
  let urlencodedParser = bodyParser.urlencoded({ extended: true });

  // The frontend needs this route to be public
  app.get('/forest/Apartment/:apartmentId', makePublic);

  app.post('/forest/actions/send-sms', urlencodedParser, LEA, (req, res) => {
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

  app.get('/forest/Apartment/house-mates', makePublic, (req, res) => {
    const { ApartmentId } = req.query;

    Promise.resolve()
      .then(() => Room.scope('latestHousemates').findAll({ where: { ApartmentId } })
      )
      .map((room) => {
        if ( room.Rentings.length === 0 || !room.Rentings[0].Client ) {
          return room;
        }

        return Client.getIdentity(room.Rentings[0].Client)
          .then((identity) => {
            room.Rentings[0].Client.identity = identity;
            return room;
          })
          .then((_room) => Promise.all([
            Client.getDescriptionFr(_room.Rentings[0].Client),
            Client.getDescriptionEn(_room.Rentings[0].Client),
          ]))
          .then(([descriptionFr, descriptionEn]) => {
            Object.assign( room.Rentings[0].Client, { descriptionEn, descriptionFr });
            return room;
          });
      })
      .map((room) => ({
        name: room.name,
        id: room.id,
        client: room.Rentings.length > 0 && room.Rentings[0].Client && {
          name: room.Rentings[0].Client.firstName,
          descriptionEn: room.Rentings[0].Client.descriptionEn,
          descriptionFr: room.Rentings[0].Client.descriptionFr,
        },
        availableAt: room.Rentings.length > 0 && room.Rentings[0].Events.length > 0 ?
        new Date(room.Rentings[0].Events[0].startDate) < new Date() ? new Date() :
        new Date(room.Rentings[0].Events[0].startDate) :
        false,
      }))
      .then((houseMates) => res.send(houseMates))
      .catch(Utils.logAndSend(res));
  });

  app.post('/forest/actions/maintenance-period', LEA, (req, res) => {
    const {values, ids} = req.body.data.attributes;

    const where = req.body.data.attributes['collection_name'] === 'Apartment' ?
      { ApartmentId : { $in : ids } } :
      { id : { $in : ids} } ;

    return Room.scope('availableAt')
      .findAll({ where })
      .filter((room) => room.checkAvailability(new Date(values.from)))
      .map((room) => room.createMaintenancePeriod(values))
      .then(Utils.createdSuccessHandler(res, 'Maintenance period'))
      .catch(Utils.logAndSend(res));
  });

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
