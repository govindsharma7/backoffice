const Aws           = require('../../vendor/aws');
const config        = require('../../config');

module.exports = function({ Picture }) {
  Picture.hook('beforeCreate', (picture) => {
    if ( config.NODE_ENV === 'test' ) {
      return picture;
    }

    return Aws.uploadPicture(picture)
      .then((url) => ( picture.url = url ));
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
