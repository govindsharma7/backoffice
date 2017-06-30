const fs              = require('fs');
const path            = require('path');
const Promise         = require('bluebird');
const Sequelize       = require('sequelize');
const config          = require('../config');

const db = {};
const sequelize = new Sequelize(
  config.SEQUELIZE_DATABASE,
  config.SEQUELIZE_USERNAME,
  config.SEQUELIZE_PASSWORD,
  {
    host: config.SEQUELIZE_HOST,
    dialect: config.SEQUELIZE_DIALECT,
    // this file is used when dialect is sqlite
    storage: config.SEQUELIZE_HOST,
    // WTF Sequelize??
    define: {
      freezeTableName: true,
    },
    benchmark: true,
  }
);
const {Model} = sequelize;

Model.prototype.requireScopes = function(_scopes, _options) {
  const options = Object.assign({}, _options, {
    where: this.where(),
    include: this._options.include || null,
  });
  const scopes = _scopes.filter((scope) => {
    return this.get(`${scope}-scope`) == null;
  });

  if ( scopes.length === 0 ) {
    return Promise.resolve(this);
  }

  return Model.scope.apply(this.constructor, scopes)
    .findOne(options)
    .then((reload) => {
      if (!reload) {
        throw new sequelize.InstanceError(
          'Instance could not be reloaded because it does not exist anymore'
        );
      }

      // update the internal options of the instance
      this._options = reload._options;
      // re-set instance values
      this.set(Object.assign({}, this.dataValues, reload.dataValues), {
        raw: true,
        reset: true && !options.attributes,
      });
      return this;
    });
};


Model._addScope = Model.addScope;
Model.addScope = function(name, definition) {
  const watermark = [sequelize.literal('1'), `${name}-scope`];
  const addWatermark = () => {
    if ( definition.attributes == null ) {
      definition.attributes = { include: [] };
    }

    if ( Array.isArray(definition.attributes) ) {
      definition.attributes.push(watermark);
    }
    else {
      definition.attributes.include.push(watermark);
    }

    return definition;
  };

  if ( typeof definition === 'function' ) {
    return this._addScope(name, function() {
      return addWatermark( name, definition.apply(null, arguments) );
    });
  }

  return this._addScope(name, addWatermark( name, definition ) );
};

// When querying a specific record by its id, remove the default paranoid scope
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

fs.readdirSync(__dirname)
  .filter(function(file) {
    return (file.indexOf('.') !== 0) && (file !== 'index.js');
  })
  .forEach(function(file) {
    var model = sequelize.import(path.join(__dirname, file));

    db[model.name] = model;
  });

Object.keys(db).forEach(function(modelName) {
  if ('associate' in db[modelName]) {
    db[modelName].associate(db);
  }

  // create one scope for each model, cause we'll probaby need 'em.
  db[modelName].addScope(modelName, {
    include: [{
      model: db[modelName],
    }],
  });
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
