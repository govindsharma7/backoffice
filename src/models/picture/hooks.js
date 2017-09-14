const fetch   = require('node-fetch');
const Aws     = require('../../vendor/aws');
const config  = require('../../config');

module.exports = function(models, Picture) {
  Picture.hook('beforeCreate', (picture) => {
    const base64Image = picture.url.replace(/^data:image\/\w+;base64,/, '');

    return fetch(
      `https://im2.io/${config.IMAGE_OPTIM_KEY}/1920x1080,fit/${base64Image}`,
      { method: 'POST' }
    )
    .then((r) => {
      return r.buffer();
    })
    .then((result) => {
      return Aws.uploadFiles(config.AWS_BUCKET_PICTURES, {
        Key: picture.id,
        Body: result,
        ACL: 'public-read',
        ContentType: 'image/jpeg',
      });
    })
    .then((url) => {
      return picture.url = url;
    });
  });
};
