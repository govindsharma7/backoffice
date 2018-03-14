const Promise       = require('bluebird');
const Aws           = require('../../vendor/aws');
const config        = require('../../config');

module.exports = function({ Picture }) {
  Picture.hook('beforeBulkCreate', (pictures) => Promise.map(
    pictures,
    Picture.handleBeforeCreate,
    { concurrency: 3 }
  ));

  Picture.handleBeforeCreate = async function(picture) {
    picture.url = await Aws.uploadPicture(picture);

    return picture;
  };
  Picture.hook('beforeCreate', (picture) =>
    Picture.handleBeforeCreate(picture)
  );

  Picture.hook('beforeDestroy', (picture) =>
    Aws.deleteFile(config.AWS_BUCKET_PICTURES, {
      Key: picture.id,
    })
  );

  Picture.hook('beforeBulkDestroy', (options) => {
    if ( !('id' in options.where) ) {
      return options;
    }

    const data = options.where.id.$in.map((id) => ({ Key: id }));

    return Aws.deleteFiles(config.AWS_BUCKET_PICTURES, data);
  });
};
