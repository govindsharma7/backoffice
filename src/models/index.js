const memoize       = require('memoize-immutable');
const WeakTupleMap  = require('weaktuplemap');
const sequelize     = require('./sequelize');
const models        = require('./models');
const Apartment     = require('./apartment');
const Client        = require('./client');
const Credit        = require('./credit');
const District      = require('./district');
const Event         = require('./event');
const Metadata      = require('./metadata');
const Order         = require('./order');
const OrderItem     = require('./orderItem');
const Payment       = require('./payment');
const Picture       = require('./picture');
const Product       = require('./product');
const Renting       = require('./renting');
const Room          = require('./room');
const Setting       = require('./setting');
const Term          = require('./term');
// Keep models sorted alphabetically (easier to make sure they're all there)
// And don't forget to add the name of the model to ./models.js !
const TotalPaid     = require('./TotalPaidView');
const {
  LatestRenting,
  CurrentRenting,
  LatestRentingByClient,
  CurrentRentingByClient,
}                   = require('./rentingViews');

const { Model } = sequelize;

Object.assign(models, {
  Apartment,
  Client,
  Credit,
  District,
  Event,
  Metadata,
  Order,
  OrderItem,
  Payment,
  Picture,
  Product,
  Renting,
  Room,
  Setting,
  Term,
  // Keep models sorted alphabetically!
  TotalPaid,
  LatestRenting,
  CurrentRenting,
  LatestRentingByClient,
  CurrentRentingByClient,
});

function addWatermark(model, name, definition) {
  const watermark = [sequelize.literal(1), `_scope_${name}`];

  if ( Array.isArray(definition.attributes) ) {
    definition.attributes.push(watermark);
  }
  else if ( definition.attributes == null ) {
    definition.attributes = { include: [watermark] };
    // TODO: report the following sequelize bug:
    // { include: … } attributes are not auto-expanded when a scoped model
    // is included in a scope. Let's work around it.
    model._expandAttributes(definition);
  }
  else {
    definition.attributes.include.push(watermark);
  }

  return definition;
}

Model.requireScopes = async function requireScopes(instance, _scopes, _options) {
  const options = Object.assign({}, _options, {
    where: instance.where(),
    include: instance._options.include || null,
  });
  const missingScopes = _scopes.filter((scope) =>
    instance.get(`_scope_${scope}`) == null
  );

  if ( missingScopes.length === 0 ) {
    return instance;
  }

  const scoped = Model.scope.apply(instance.constructor, missingScopes);
  const reloaded = await scoped.findOne(options);

  if ( !reloaded ) {
    throw new sequelize.InstanceError(
      'Instance could not be reloaded because it does not exist anymore'
    );
  }

  // update the internal options of the instance
  instance._options = reloaded._options;
  // re-set instance values
  instance.set(Object.assign({}, instance.dataValues, reloaded.dataValues), {
    raw: true,
    reset: true && !options.attributes,
  });

  return instance;
};

// TODO: find out why using requireScopesMemoized doesn't work and fix this!
Model.requireScopesMemoized = memoize(Model.requireScopes, { cache: new WeakTupleMap() });

Model._addScope = Model.addScope;
Model.addScope = function(name, definition) {
  const self = this;

  return self._addScope(name, typeof definition === 'function' ?
    function() { return addWatermark(self, name, definition.apply(null, arguments)); } :
    addWatermark(self, name, definition )
  );
};

Model.prototype.hasScope = function(name) {
  return this.get(`_scope_${name}`) === 1;
};

// This method should only be used in collection.js files
// In other files, scopes should simply be required using Model#scope
Model.prototype.requireScopes = function(_scopes, _options) {
  return Model.requireScopes(this, _scopes, _options);
};

// Find by id should return soft-deleted records
sequelize.addHook('beforeFind', (options) => {
  if (
    options.where &&
    Object.keys(options.where).join() === 'id' &&
    typeof options.where.id === 'string'
  ) {
    options.paranoid = false;
  }

  return true;
});

Object.keys(models).forEach(function(modelName) {
  if ('associate' in models[modelName]) {
    models[modelName].associate(models);
  }

  if ('hooks' in models[modelName]) {
    models[modelName].hooks(models);
  }
});

module.exports = models;
