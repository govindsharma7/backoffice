const Promise       = require('bluebird');
const Aws           = require('../../vendor/aws');
const config        = require('../../config');

module.exports = function({ Picture }) {
  Picture.hook('beforeBulkCreate', (pictures) => {
    if ( config.NODE_ENV === 'test' ) {
      return pictures;
    }

    return Promise.map(
      pictures,
      Picture.handleBeforeCreate,
      { concurrency: 3 }
    );
  });

  Picture.handleBeforeCreate = async function(picture) {
    const url = await Aws.uploadPicture(picture);

    picture.url = url;

    return picture;
  };
  Picture.hook('beforeCreate', (picture) => {
    if ( config.NODE_ENV === 'test' ) {
      return picture;
    }
    return Picture.handleBeforeCreate(picture);
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
