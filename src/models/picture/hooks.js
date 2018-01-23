const Aws           = require('../../vendor/aws');
const config        = require('../../config');

module.exports = function({ Picture }) {
  Picture.hook('beforeCreate', async (picture) => {
    if ( config.NODE_ENV === 'test' ) {
      return picture;
    }

    const url = await Aws.uploadPicture(picture);

    picture.url = url;

    return picture;
  });

  Picture.hook('beforeDestroy', (picture) => {
    if ( config.NODE_ENV === 'test' ) {
      return picture;
    }

    return Aws.deleteFile(config.AWS_BUCKET_PICTURES, {
      Key: picture.id,
    });
  });

  Picture.hook('beforeBulkDestroy', (options) => {
    if ( config.NODE_ENV === 'test' || !('id' in options.where) ) {
      return options;
    }

    const data = options.where.id.$in.map((id) => ({ Key: id }));

    return Aws.deleteFiles(config.AWS_BUCKET_PICTURES, data);
  });
};
