const Promise          = require('bluebird');
const pick             = require('lodash/pick');
const Liana            = require('forest-express-sequelize');
const makePublic       = require('../../middlewares/makePublic');
const Utils            = require('../../utils');

const _ = { pick };

module.exports = function(app, models, Room) {
  const LEA = Liana.ensureAuthenticated;

  // Make the room listing and details endpoint public, for chez-nestor.com
  app.get('/forest/Room', makePublic);
  app.get('/forest/Room/:recordId', makePublic);

  app.post('/forest/actions/update-apartment-and-room', LEA, (req, res) => {
    const { room, apartment } = req.body;
    const descriptionFields =
      ['Fr', 'En', 'Es'].map((lang) => { return `description${lang}`; });
    const addressFields =
      ['Street', 'Zip', 'City', 'Country'].map((name) => { return `address${name}`; });
    const roomFields =
      ['floorArea', 'basePrice', 'beds'].concat(descriptionFields);
    const apartmentFields =
      ['floor', 'DistrictId', 'elevator', 'floorArea', 'code'].concat(
        descriptionFields,
        addressFields
      );

    Promise.resolve()
      .then(() => {
        return Promise.all([
          models.Room.findById(room.id),
          models.Apartment.findById(apartment.id),
        ]);
      })
      .then(([_room, _apartment]) => {
        return Promise.all([
          _room.update( _.pick(room, roomFields) ),
          _apartment.update( _.pick(apartment, apartmentFields) ),
        ]);
      })
      .then(Utils.createSuccessHandler(res, 'Room and Apartment'))
      .catch(Utils.logAndSend(res));
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
