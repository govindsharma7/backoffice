const makePublic       = require('../../middlewares/makePublic');
const Utils            = require('../../utils');
const Op               = require('../../operators');

module.exports = function(app, { Room, Client }) {

  // Make the room listing and details endpoint public, for chez-nestor.com
  app.get('/forest/Room', makePublic);
  app.get('/forest/Room/:recordId', makePublic);

  Utils.addInternalRelationshipRoute({
    app,
    sourceModel: Room,
    associatedModel: Client,
    routeName: 'current-client',
    scope: 'currentApartment',
    where: (req) => ({
      '$Rentings.RoomId$': req.params.recordId,
      '$Rentings.bookingDate$': { [Op.lte]:  new Date() },
    }),
  });

  Utils.addRestoreAndDestroyRoutes(app, Room);
};
