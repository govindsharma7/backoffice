const Promise         = require('bluebird');
const sortBy          = require('lodash/sortBy');
const map             = require('lodash/map');
const reduce          = require('lodash/reduce');
const sequelize       = require('../models/sequelize');
const { ENUMS }       = require('../const');

const _ = { sortBy, map, reduce };
const rBase64Image = /^data:image\/\w+;base64,/;

module.exports = function(Model, Picture) {
  const getPictures = getPicturesMemoizer({ Picture, Model });
  const updatePictures = updatePicturesMemoizer({ Picture, Model });
  const alts = Object.keys(ENUMS[`${Model.name.toLowerCase()}PicsAlts`]);

  const galeryField = {
    field: 'galery',
    type: ['String'],
    async get(object) {
      const pics = await getPictures({ object });

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
        // TODO: beforeBulkDestroy has never been tested
        toCreate && Picture.destroy({ where: { id: { $in: toDestroy } } }),
        toDestroy && Picture.bulkCreate(toCreate, { individualHooks: true }),
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
        const pics = await getPictures({ object });

        // Using Array#find wouldn't work here as pics might not have .order set
        return (pics[key] || {})[propName];
      },
      async set(object) {
        await updatePictures({ object });

        return object;
      },
    }))
  );

  return [].concat.apply([galeryField], picFields);
};

function getPicturesMemoizer({ Picture }) {
  const cache = new WeakMap();

  return ({ object }) => {
    if ( cache.has(object) ) {
      return cache.get(object);
    }

    const promise = Picture.findAll({
      where: { PicturableId: object.id },
      order: [['order', 'ASC']],
    });

    cache.set(object, promise);

    return promise;
  };
}

// We'll take care of all individual updated fields for an apartment/room in one shot
function updatePicturesMemoizer({ Picture, Model }) {
  const cache = new WeakMap();

  return ({ object }) => {
    if ( cache.has(object) ) {
      return cache.get(object);
    }

    const _transaction = sequelize.transaction(async (transaction) => {
      const dbPictures = await Picture.findAll({
        where: { PicturableId: object.id },
        order: [['order', 'ASC']],
        transaction,
      });

      let maxOrder =
        _.reduce(dbPictures, (max, pic) => Math.max(max, pic.order), 0);
      const updatedPics = _.reduce(object, (acc, val, key) => {
        const match = key.match(/pic (\d+) (\w+)/);

        if ( !match ) {
          return acc;
        }

        const [, rowNumber, propName] = match;

        if ( !(rowNumber in acc) ) {
          acc[rowNumber] = {};
        }
        acc[rowNumber][propName] = val;

        return acc;
      }, {});

      return Promise.map(Object.entries(updatedPics), ([rowNumber, pic]) => {
        if ( pic.url ) {
          Object.assign(
            pic,
            { picturable: Model.name, PicturableId: object.id },
            ( pic.order == null || pic.order === '' ) && { order: ++maxOrder }
          );

          return Picture.create(pic, { transaction });
        }

        return Picture.update(pic, {
          where: { id: dbPictures[rowNumber].id },
          transaction,
        });
      }, { concurrency: 3 });
    });

    cache.set(object, _transaction);

    return _transaction;
  };
}
