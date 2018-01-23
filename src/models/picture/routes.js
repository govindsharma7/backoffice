const Liana   = require('forest-express-sequelize');
const Aws     = require('../../vendor/aws');
const makePublic     = require('../../middlewares/makePublic');
const Utils   = require('../../utils');

module.exports = (app) => {
  const LEA = Liana.ensureAuthenticated;

  app.get('/forest/Picture', (req, res, next) =>
    (
      req.query.filterType === 'or' &&
      /PicturableId/.test(Object.keys(req.query.filter).join(''))
    ) ?
      makePublic(req, res, next) :
      LEA(req, res, next));
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
};
