const Promise = require('bluebird');
const Liana   = require('forest-express-sequelize');
const Aws     = require('../../vendor/aws');
const Utils   = require('../../utils');

const rBase64Image = /^data:image\/\w+;base64,/;

function findNewPictures(pictures) {
  return pictures.filter((picture) => {
    return rBase64Image.test(picture.url);
  });
}

function createNewPictures(pictures, model) {
  return pictures.map(({ id, url, PicturableId, picturable, alt}) => {
    return model.create({
      id,
      url,
      PicturableId,
      picturable,
      alt,
    });
  });
}

function deletePictures(oldPictures, newPictures) {
  return oldPictures.map((_picture) => {
    if ( !( newPictures.some((picture) => {
      return picture.id === _picture.id;
    }))) {
      return _picture.destroy();
    }
    return _picture;
  });
}

module.exports = (app, models) => {
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

  app.post('/forest/actions/public/updatePictures', LEA, (req, res) => {
    const {
      roomId,
      apartmentId,
      RoomPictures,
      ApartmentPictures,
    } = req.body;

    Promise.resolve()
      .then(() => {
        return Promise.all([
          findNewPictures(ApartmentPictures),
          findNewPictures(RoomPictures),
        ]);
      })
      .then(([ApartmentPicturesAdd, RoomPicturesAdd]) => {
        return Promise.all([
          createNewPictures(ApartmentPicturesAdd, models.Picture),
          createNewPictures(RoomPicturesAdd, models.Picture),
        ]);
      })
      .then(() => {
        return Promise.all([
          models.Picture.findAll({where: { PicturableId: roomId } }),
          models.Picture.findAll({where: { PicturableId: apartmentId } }),
        ]);
      })
      .then(([oldRoomPictures, oldApartmentPictures]) => {
        return Promise.all([
          deletePictures(oldRoomPictures, RoomPictures),
          deletePictures(oldApartmentPictures, ApartmentPictures),
        ]);
      })
      .then(Utils.createSuccessHandler(res, 'Terms'))
      .catch((e) => {
        return res.status(400).send(e);
      });
  });
};
