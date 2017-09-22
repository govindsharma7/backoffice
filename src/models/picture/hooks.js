const Aws     = require('../../vendor/aws');
const config  = require('../../config');

module.exports = function(models, Picture) {
  Picture.hook('beforeCreate', (picture) => {
    return Aws.uploadPicture(picture)
      .then((url) => {
        return picture.url = url;
      });
  });

  Picture.hook('beforeDelete', (picture) => {
    return Aws.deleteFile(config.AWS_BUCKET_PICTURES, {
      Key: picture.id,
    });
  });
};
