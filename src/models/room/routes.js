const D                = require('date-fns');
const makePublic       = require('../../middlewares/makePublic');
const pictures         = require('../../pictures.json');
const Utils            = require('../../utils');


module.exports = function(app, models, Room) {
  // Make the room listing endpoint public, for chez-nestor.com
  app.get('/forest/Room', makePublic);

  app.get('/forest/Room/:recordId/relationships/Pictures', makePublic, (req, res) => {
    Room
      .findById(req.params.recordId)
      .then((room) => {
        const roomPictures = pictures[room.reference];

        return res.send({
          data: roomPictures.map((picture) => {
            return {
              id: null,
              type: 'Picture',
              attributes: {
                href: picture,
              },
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
