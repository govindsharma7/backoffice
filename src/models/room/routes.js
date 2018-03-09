const makePublic       = require('../../middlewares/makePublic');
const Utils            = require('../../utils');

module.exports = function(app, { Room, Client }) {

  // Make the room listing and details endpoint public, for chez-nestor.com
  app.get('/forest/Room', makePublic);
  app.get('/forest/Room/:recordId', makePublic);

  Utils.addInternalRelationshipRoute({
    app,
    sourceModel: Room,
    associatedModel: Client.scope('currentApartment'),
    routeName: 'current-client',
    where: (req) => ({ '$Rentings.RoomId$': req.params.recordId }),
  });

  Utils.addRestoreAndDestroyRoutes(app, Room);
};
