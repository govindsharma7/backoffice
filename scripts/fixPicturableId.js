#!/usr/bin/env node

const Promise = require('bluebird');
const models  = require('../src/models');

const {Picture} = models;

return Picture.findAll()
  .then((pictures) => updatePicturableId(pictures));



function updatePicturableId(pictures) {
  return Promise.mapSeries(pictures, (picture) =>
    models[picture.picturable].find({
      where: { reference: picture.PicturableId },
    })
    .then((category) => {
      if (!category ) {
        return console.log(picture.PicturableId);
      }
      return picture.update({PicturableId: category.id });
    }))
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
    });
}
