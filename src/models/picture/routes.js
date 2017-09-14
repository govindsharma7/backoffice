const Liana   = require('forest-express-sequelize');
const Aws     = require('../../vendor/aws');
const config  = require('../../config');
const Utils   = require('../../utils');


module.exports = (app) => {
  const LEA = Liana.ensureAuthenticated;

  app.put('/forest/Picture/:pictureId', LEA, (req, res, next) => {
    const {url} = req.body.data.attributes;


    if ( url ) {
      const base64Image = url.replace(/^data:image\/\w+;base64,/, '');

      return Aws.uploadFiles(config.AWS_BUCKET_PICTURES, {
        Key: req.params.pictureId,
        Body: new Buffer(base64Image, 'base64'),
        ContentEncoding: 'base64',
        ACL: 'public-read',
        ContentType: 'image/jpeg',
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
