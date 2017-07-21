const D                = require('date-fns');
const Liana            = require('forest-express-sequelize');
//const uuid             = require('uuid/v4');
const makePublic       = require('../../middlewares/makePublic');
const pictures         = require('../../pictures.json');
const Utils            = require('../../utils');


module.exports = function(app, models, Room) {
  const LEA = Liana.ensureAuthenticated;

  // Make the room listing endpoint public, for chez-nestor.com
  app.get('/forest/Room', makePublic);

  app.get('/forest/Room/:recordId/relationships/Pictures', LEA, (req, res) => {
    Room
      .findById(req.params.recordId)
      .then((room) => {
        return pictures[room.reference];
      })
      .then((roomPictures) => {
      return res.send({
          data: roomPictures.map((picture) => {
            return {
              href: picture,
              type: 'Picture',
            };
          }),
          meta: {count: roomPictures.length },
        });
      })
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
        '$Rentings.bookingDate$': { $lte:  D.format(Date.now()) },
      };
    },
  });

  Utils.addRestoreAndDestroyRoutes(app, Room);
};
