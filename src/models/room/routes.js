const D                = require('date-fns');
const makePublic       = require('../../middlewares/makePublic');
const Utils            = require('../../utils');

module.exports = function(app, models, Room) {
  // Make the room listing endpoint public, for chez-nestor.com
  app.get('/forest/Room', makePublic);

  Utils.addInternalRelationshipRoute({
    app,
    sourceModel: Room,
    associatedModel: models.Client,
    routeName: 'current-client',
    scope: 'currentApartment',
    where: (req) => {
      return {
        '$Rentings.RoomId$': req.params.recordId,
        '$Rentings.bookingDate$': { $lte:  D.format(Date.now()) },
      };
    },
  });

  Utils.addInternalRelationshipRoute({
    app,
    sourceModel: Room,
    associatedModel: models.Client,
    routeName: 'future-client',
    scope: 'currentApartment',
    where: (req) => {
      return {
        '$Rentings.RoomId$': req.params.recordId,
        '$Rentings.bookingDate$': { $gt:  D.format(Date.now()) },
      };
    },
  });

  Utils.addInternalRelationshipRoute({
    app,
    sourceModel: Room,
    associatedModel: models.Client,
    routeName: 'past-client',
    scope: 'pastApartment',
    where: (req) => {
      return {
        '$Rentings.RoomId$': req.params.recordId,
        '$Rentings.bookingDate$': { $lt:  D.format(Date.now()) },
      };
    },
  });

  Utils.addRestoreAndDestroyRoutes(app, Room);
};
