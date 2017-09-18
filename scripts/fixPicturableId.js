#!/usr/bin/env node

const Promise = require('bluebird');
const models  = require('../src/models');

const {Picture} = models;

return Picture.findAll()
  .then((pictures) => {
    return updatePicturableId(pictures);
});



function updatePicturableId(pictures) {
  return Promise.mapSeries(pictures, (picture) => {
    return models[picture.picturable].find({
      where: {
        reference: picture.PicturableId,
      },
    })
    .then((category) => {
      if (!category ) {
        return console.log(picture.PicturableId);
      }
      return picture.update({PicturableId: category.id });
    });
  });
}
