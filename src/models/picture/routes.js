const Liana   = require('forest-express-sequelize');
const Aws     = require('../../vendor/aws');
const Utils   = require('../../utils');


module.exports = (app) => {
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
          return next();
        })
        .catch(Utils.logAndSend(res));
    }

    return next();
  });
};
