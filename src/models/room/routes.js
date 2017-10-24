const Promise          = require('bluebird');
const Liana            = require('forest-express-sequelize');
const makePublic       = require('../../middlewares/makePublic');
const Utils            = require('../../utils');


module.exports = function(app, models, Room) {
  const LEA = Liana.ensureAuthenticated;

  // Make the room listing and details endpoint public, for chez-nestor.com
  app.get('/forest/Room', makePublic);
  app.get('/forest/Room/:recordId', makePublic);

  app.post('/forest/actions/public/update-apartment-and-room', LEA, (req, res) => {
    const {room, apartment } = req.body;

    Promise.resolve()
      .then(() => {
        return Promise.all([
          models.Room.findById(room.id),
          models.Apartment.findById(apartment.id),
        ]);
      })
      .then(([_room, _apartment]) => {
        return Promise.all([
          _room.update({
            floorArea: room.floorArea,
            basePrice: room.basePrice,
            beds: room.beds,
            descriptionFr: room.descriptionFr,
            descriptionEn: room.descriptionEn,
            descriptionEs: room.descriptionEs,
          }),
          _apartment.update({
            addressStreet: apartment.addressStreet,
            addressZip: apartment.addressZip,
            addressCity: apartment.addressCity,
            addressCountry: apartment.addressCountry,
            floor: apartment.floor,
            DistrictId: `${apartment.addressCity}-${apartment.district}`,
            elevator: apartment.elevator,
            floorArea: apartment.floorArea,
            code: apartment.code,
            descriptionFr: apartment.descriptionFr,
            descriptionEn: apartment.descriptionEn,
            descriptionEs: apartment.descriptionEs,
          }),
        ]);
      })
      .then(Utils.createSuccessHandler(res, 'Terms'))
      .catch((e) => {
        return res.status(400).send(e);
      });
  });

  Utils.addInternalRelationshipRoute({
    app,
    sourceModel: Room,
    associatedModel: models.Client,
    routeName: 'current-client',
    scope: 'currentApartment',
    where: (req) => {
      return {
        '$Rentings.RoomId$': req.params.recordId,
        '$Rentings.bookingDate$': { $lte:  new Date() },
      };
    },
  });

  Utils.addRestoreAndDestroyRoutes(app, Room);
};
