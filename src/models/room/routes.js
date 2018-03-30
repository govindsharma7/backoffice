const Promise           = require('bluebird');
const _                 = require('lodash');
const Liana             = require('forest-express-sequelize');
const sequelize         = require('../sequelize');
const makePublic        = require('../../middlewares/makePublic');
const Utils             = require('../../utils');
const Op                = require('../../operators');

module.exports = function(app, { Room, Client, Picture, Apartment }) {

  // Make the room listing and details endpoint public, for chez-nestor.com
  app.get('/forest/Room', makePublic);
  app.get('/forest/Room/:recordId', makePublic);

  const SellableRoomScope = Room.scope([
    { method: ['availableAt', { availability: 'sellable' }] },
  ]);

  // Retrieving just the right amount of info for the website using segments
  // was a pain, so we implemented a specific route
  app.get('/forest/SellableRoom', async (req, res) => {
    const { page, zone, fields: _fields } = req.query;
    const zips =
      zone.replace(/[^\d,]/g, '').split(',').map((arrdt) => `6900${arrdt}`);
    const zoneFilter = /^lyon\d/.test(zone) ?
      { '$Apartment.addressZip$': { [Op.or]: zips } } :
      { '$Apartment.addressCity$': zone };
    const where = Object.assign({ status: 'active' }, zoneFilter);
    const include = [Apartment];
    const params = {
      where,
      include,
      order: [sequelize.col('Rentings->Events.startDate')],
      limit: Number(page.size),
      offset: ( Number(page.number) - 1 ) * Number(page.size),
    };
    const [count, rooms] = await Promise.all([
      SellableRoomScope.count({ where, include }),
      SellableRoomScope.findAll(params),
    ]);

    if ( rooms.length ) {
      const picturableIds =
        _.uniq(_.flatten(rooms.map(({ id, ApartmentId }) => ([id, ApartmentId]))));
      // TODO: find a way to avoid using a third request to retrieve that data
      const pictures = await Picture.findAll({
        where: { PicturableId: { [Op.in]: picturableIds } },
      });

      rooms.forEach((room) =>
        room.Pictures =
          pictures
            .filter(({ PicturableId }) =>
              PicturableId === room.id || PicturableId === room.ApartmentId
            )
            .sort((pic1, pic2) =>
              pic1.order * ( pic1.picturable === 'Room' ? 1 : 100 ) -
              pic2.order * ( pic2.picturable === 'Room' ? 1 : 100 )
            )
      );
    }

    const fakeImpl = { getModelName: () => 'Room' };
    const fields = _.mapValues(_fields, (strFields) => strFields.split(','));
    const serializer =
      new Liana.ResourceSerializer(fakeImpl, null, rooms, null, {}, { count }, fields);
    const invoices = await serializer.perform();

    return res.send(invoices);
  });

  Utils.addInternalRelationshipRoute({
    app,
    sourceModel: Room,
    associatedModel: Client.scope('currentApartment'),
    routeName: 'current-client',
    where: (req) => ({ '$Rentings.RoomId$': req.params.recordId }),
  });

  Utils.addRestoreAndDestroyRoutes(app, Room);
};
