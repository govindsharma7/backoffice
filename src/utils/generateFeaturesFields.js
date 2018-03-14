const _               = require('lodash');
const Op              = require('../operators');
const sequelize       = require('../models/sequelize');
const { ENUMS }       = require('../const');

module.exports = function(Model, Term) {
  const featuresPrefix = `${Model.name.toLowerCase()}-features-`;
  const getFeatures = getFeaturesMemoizer({ featuresPrefix, Term, Model });
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
        // This is actually useless and needs to be done from the UI. F*CK!
        description: termName.replace(/[A-Z]/g, ($0) => ` ${$0.toLowerCase()}`),
        type: 'Boolean',
        async get(object) {
          const features = await getFeatures({ object });

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

function getWhere({ object, featuresPrefix }) {
  return { [Op.and]: [
    { taxonomy: { [Op.like]: `${featuresPrefix}%` } },
    { TermableId: object.id },
  ] };
}

function getFeaturesMemoizer({ featuresPrefix, Term }) {
  const cache = new WeakMap();

  return ({ object }) => {
    if ( cache.has(object) ) {
      return cache.get(object);
    }

    const promise = Term.findAll({ where: getWhere({ object, featuresPrefix }) });

    cache.set(object, promise);

    return promise;
  };
}

// We'll take care of all individual updated fields for an apartment/room in one shot
function updateFeaturesMemoizer({ featuresPrefix, Term, Model }) {
  const cache = new WeakMap();

  return ({ object, defaults }) => {
    if ( cache.has(object) ) {
      return cache.get(object);
    }

    const _transaction = sequelize.transaction(async (transaction) => {
      const where = getWhere({ object, featuresPrefix });
      const dbFeatures = await Term.findAll({ where, transaction });
      const currFeatures = dbFeatures.length ?
        dbFeatures.map((term) =>
          _.pick(term, 'taxonomy,name,termable,TermableId'.split(','))
        ) :
        defaults.map((feature) =>
          Object.assign({ TermableId: object.id }, feature)
        );

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
