const Promise = require('bluebird');
const Liana   = require('forest-express-sequelize');
const Aws     = require('../../vendor/aws');
const Utils   = require('../../utils');


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
    const rBase64Image = /^data:image\/\w+;base64,/;

    Promise.resolve()
      .then(() => {
        return Promise.all([
          ApartmentPictures.filter((pic) => {
            return rBase64Image.test(pic.url);
          }),
          RoomPictures.filter((pic) => {
            return rBase64Image.test(pic.url);
          }),
        ]);
      })
      .then(([ApartmentPicturesAdd, RoomPicturesAdd]) => {
        return Promise.all([
          ApartmentPicturesAdd.map(({ id, url, PicturableId, picturable, alt}) => {
            return models.Picture.create({
              id,
              url,
              PicturableId,
              picturable,
              alt,
            });
          }),
          RoomPicturesAdd.map(({ id, url, PicturableId, picturable, alt}) => {
            return models.Picture.create({
              id,
              url,
              PicturableId,
              picturable,
              alt,
            });
          }),
        ]);
      })
      .then(() => {
        return Promise.all([
          models.Picture.findAll({where: { PicturableId: roomId } }),
          models.Picture.findAll({where: { PicturableId: apartmentId } }),
        ]);
      })
      .then(([_RoomPictures, _ApartmentPictures]) => {
        return Promise.all([
          _RoomPictures.map((_picture) => {
            if ( !( RoomPictures.some((picture) => {
              return picture.id === _picture.id;
            }))) {
              return _picture.destroy();
            }
            return _picture;
          }),
          _ApartmentPictures.map((_picture) => {
            if ( !( ApartmentPictures.some((picture) => {
              return picture.id === _picture.id;
            }))) {
              return _picture.destroy();
            }
            return _picture;
          }),
        ]);
      })
      .then(Utils.createSuccessHandler(res, 'Terms'))
      .catch((e) => {
        return res.status(400).send(e);
      });
  });
};
