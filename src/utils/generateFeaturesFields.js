const pick            = require('lodash/pick');
const pickBy          = require('lodash/pickBy');
const map             = require('lodash/map');
const forEach         = require('lodash/forEach');
const sequelize       = require('../models/sequelize');
const { ENUMS }       = require('../const');
const methodMemoizer  = require('./methodMemoizer');

const _ = { pick, pickBy, map, forEach };

module.exports = function(Model, Term) {
  const featuresPrefix = `${Model.name.toLowerCase()}-features-`;
  const getFeatures = methodMemoizer({
    model: Model,
    method: 'getTerms',
    args: { where: { taxonomy: { $like: `${featuresPrefix}%` } } },
  });
  const updateFeatures = updateFeaturesMemoizer({ featuresPrefix, Term, Model });
  const featureTaxonomies = _.pickBy(ENUMS, (value, key) =>
    key.indexOf(featuresPrefix) === 0
  );
  const featuresFields = [];
  const defaults = [];

  // Add one virtual field for each potential feature of the room/apartment
  _.forEach(featureTaxonomies, (featuresDefs, taxonomyName) =>
    _.forEach(featuresDefs, (featureDef, termName) => {
      featuresFields.push({
        field: `${taxonomyName}-${termName}`,
        description: termName.replace(/[A-Z]/g, ($0) => ` ${$0.toLowerCase()}`),
        type: 'Boolean',
        async get(object) {
          const features = await getFeatures(object);

          // If features have never been modified/saved, return default features
          return features.length ?
            features.some(({ taxonomy, name }) =>
              taxonomy === taxonomyName && name === termName
            ) :
            ENUMS[taxonomyName][termName].default || false;
        },
        async set(object) {
          await updateFeatures({ object, defaults });

          return object;
        },
      });

      // Populate the object with all default features
      if ( featureDef.default === true ) {
        defaults.push({
          taxonomy: taxonomyName,
          name: termName,
          termable: Model.name,
        });
      }
    })
  );

  return featuresFields;
};

// We'll take care of all individual updated fields for an apartment/room in one shot
function updateFeaturesMemoizer({ featuresPrefix, Term, Model }) {
  const cache = new WeakMap();

  return ({ object, defaults }) => {
    if ( cache.has(object) ) {
      return cache.get(object);
    }

    const _transaction = sequelize.transaction(async (transaction) => {
      const where = { $and: [
        { taxonomy: { $like: `${featuresPrefix}%` } },
        { TermableId: object.id },
      ] };
      const dbFeatures = await Term.findAll({ where, transaction });
      const currFeatures = dbFeatures.length ?
        dbFeatures.map((term) =>
          _.pick(term, 'taxonomy,name,termable,TermableId'.split(','))
        ) :
        defaults.map((feature) => Object.assign({ TermableId: object.id }, feature));

      // Remove features that are no longer "true"
      const nextFeatures = currFeatures.filter(({ taxonomy, name }) =>
        object[`${taxonomy}-${name}`] !== false && object[`${taxonomy}-${name}`] !== null
      );

      // Add new features
      _.forEach(object, (value, key) => {
        if ( key.indexOf(featuresPrefix) !== 0 || value !== true ) {
          return;
        }

        const [, , suffix, name] = key.split('-');
        const taxonomy = `${featuresPrefix}${suffix}`;

        nextFeatures.push({
          taxonomy,
          name,
          termable: Model.name,
          TermableId: object.id,
        });
      });

      await Term.destroy({ where, transaction });
      await Term.bulkCreate(nextFeatures, { transaction });
    });

    cache.set(object, _transaction);

    return _transaction;
  };
}
