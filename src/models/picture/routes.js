const Promise = require('bluebird');
const Liana   = require('forest-express-sequelize');
const pick    = require('lodash/pick');
const Aws     = require('../../vendor/aws');
const Utils   = require('../../utils');

const _ = { pick };

module.exports = (app, models, Picture) => {
  const LEA = Liana.ensureAuthenticated;

  app.put('/forest/Picture/:pictureId', LEA, (req, res, next) => {
    const { url } = req.body.data.attributes;

    if ( url ) {
      return Aws.uploadPicture({
          id: req.params.pictureId,
          url,
        })
        .then((AWSurl) => {
          req.body.data.attributes.url = AWSurl;
          /* eslint-disable promise/no-callback-in-promise */
          return next();
          /* eslint-enable promise/no-callback-in-promise */
        })
        .catch(Utils.logAndSend(res));
    }

    return next();
  });

  // Updating the pictures of a Room / Apartement is done by creating all new
  // pictures, and deleting the ones which need be deleted
  app.post('/forest/actions/update-pictures', LEA, (req, res) => {
    const {
      roomId,
      apartmentId,
      RoomPictures,
      ApartmentPictures,
    } = req.body;
    const rBase64Image = /^data:image\/\w+;base64,/;
    const nextPictures = [].concat(RoomPictures, ApartmentPictures);

    Promise.resolve()
      .then(() => {
        const toUpdate = nextPictures
          .filter((picture) => { return !rBase64Image.test(picture.url); });

        return toUpdate.map((pic) => {
          return Picture.update(
            _.pick(pic, ['alt', 'order']),
           { where: { id: pic.id }}
          );
        });
      })
      .then(() => {
        const toCreate = nextPictures
          .filter((picture) => { return rBase64Image.test(picture.url); });

        return Picture.bulkCreate( toCreate );
      })
      .then(() => {
        return Picture
          .findAll({ where: { PicturableId: { $in: [roomId, apartmentId] } } });
      })
      .then((currPictures) => {

        // Destroy currPictures that are not present in nextPictures
        const currPicIds = currPictures.map((pic) => { return pic.id; });
        const nextPicIds = nextPictures.map((pic) => { return pic.id; });
        const toDeleteIds = currPicIds
          .filter((currPicId) => { return !nextPicIds.includes(currPicId); });

        return Picture.destroy({ where: { id: { $in: toDeleteIds } } });
      })
      .then(Utils.createSuccessHandler(res, 'Terms'))
      .catch((e) => {
        return res.status(400).send(e);
      });
  });
};
