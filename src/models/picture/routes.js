const Promise = require('bluebird');
const Liana   = require('forest-express-sequelize');
const Aws     = require('../../vendor/aws');
const Utils   = require('../../utils');


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

  // Updating the pictures of a Room / Apartement is done by deleting all
  // existing pictures and creating them anew.
  app.post('/forest/actions/update-pictures', LEA, (req, res) => {
    const {
      roomId,
      apartmentId,
      RoomPictures,
      ApartmentPictures,
    } = req.body;
    const rBase64Image = /^data:image\/\w+;base64,/;
    const nextPictures = [].concat([RoomPictures, ApartmentPictures]);

    Promise.resolve()
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
        const toDelete = currPictures
          .filter((currPic) => {
            return !nextPictures.some((nextPic) => { return currPic.id === nextPic.id; });
          });

        return Picture.destroy( toDelete );
      })
      .then(Utils.createSuccessHandler(res, 'Terms'))
      .catch((e) => {
        return res.status(400).send(e);
      });
  });
};
