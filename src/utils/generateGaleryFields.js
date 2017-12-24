const Promise         = require('bluebird');
const sortBy          = require('lodash/sortBy');
const map             = require('lodash/map');
const methodMemoizer  = require('./methodMemoizer');

const _ = { sortBy, map };
const rBase64Image = /^data:image\/\w+;base64,/;

module.exports = function(Model, Picture, alts) {
  const getPictures = methodMemoizer(Model, 'getPictures');

  const galeryField = {
    field: 'galery',
    type: ['String'],
    async get(object) {
      const pics = await getPictures(object);

      return _.sortBy(pics, ['order']).map(({ url }) => url);
    },
    async set(object, nextUrls) {
      // setters might be called even though their field shouldn't be updated :-/
      if ( nextUrls === undefined ) {
        return object;
      }

      const basePic = { picturable: Model.name, PicturableId: object.id };
      const currPics = await getPictures(object);
      const toCreate =
        nextUrls
          .filter((url) => rBase64Image.test(url))
          .map((url) => Object.assign({ url }, basePic));
      const toDestroy =
        currPics && currPics
          .filter(({ url }) => !nextUrls.includes(url))
          .map(({ id }) => id);

      await Promise.all([
        toCreate && Picture.destroy({ where: { id: { $in: toDestroy } } }),
        toDestroy && Picture.bulkCreate(toCreate),
      ]);

      return object;
    },
  };

  const picFields = Array.from(Array(10)).map((val, key) =>
    _.map({ alt: 'Enum', order: 'Number', url: 'String' }, (type, propName) => ({
      field: `pic ${key} ${propName}`,
      type,
      enums: propName === 'alt' ? alts : undefined,
      async get(object) {
        const pics = await getPictures(object);

        // Using Array#find wouldn't work here as pics might not have .order set
        return ( _.sortBy(pics, ['order'])[key] || {})[propName];
      },
      async set(object, value) {
        // setters might be called even though their field shouldn't be updated :-/
        if ( value === undefined ) {
          return object;
        }

        const pics = await getPictures(object);
        const toUpdateId = _.sortBy(pics, ['order'])[key].id;

        await Picture.update({ [propName]: value }, { where: { id: toUpdateId } });

        return object;
      },
    }))
  );

  return [].concat.apply([galeryField], picFields);
};
