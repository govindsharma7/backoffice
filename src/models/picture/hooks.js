const Aws           = require('../../vendor/aws');
const config        = require('../../config');

module.exports = function({ Picture }) {
  Picture.hook('beforeCreate', async (picture) => {
    if ( config.NODE_ENV === 'test' ) {
      return picture;
    }

    console.log('THERE1');

    const url = await Aws.uploadPicture(picture);

    console.log('THERE2');

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

  // TODO: this code has never been run but might be useful if use the galery
  // to create/delete picture in the future (which we want)
  Picture.hook('beforeBulkDestroy', (options) => {
    if ( config.NODE_ENV === 'test' ) {
      return options;
    }

    const data = options.where.id.$in.map((id) => ({ Key: id }));

    return Aws.deleteFiles(config.AWS_BUCKET_PICTURES, data);
  });
};
