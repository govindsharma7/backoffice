const fs                  = require('fs');
const path                = require('path');
const forEach             = require('lodash/forEach');
const Sequelize           = require('sequelize');
const config              = require('../config');

const _ = { forEach };
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
  }
);
const db = {};

fs.readdirSync(__dirname)
  .filter(function(file) {
    return (file.indexOf('.') !== 0) && (file !== 'index.js');
  })
  .forEach(function(file) {
    const model = sequelize.import(path.join(__dirname, file));

    db[model.name] = model;
  });

// const {
//   nodeTypeMapper,
// } = relay.sequelizeNodeInterface(sequelize);

_.forEach(db, (model) => {
  if ( 'rawAssociations' in model ) {
    model.rawAssociations.forEach((_raw) => {
      const raw = Object.assign({}, _raw);
      const {options} = raw;
      let type;
      let targetName;

      delete raw.options;
      // there should be only one key left at this point
      type = Object.keys(raw)[0];
      targetName = raw[type];
      model[type](db[targetName], options);
    });
  }
});

_.forEach(db, (model) => {
  // model.connections = Object.keys(model.associations).map((associationName) => {
  //   return relay.sequelizeConnection({
  //     name: associationName,
  //     nodeType: types[model.associations[associationName].target.name],
  //     target: model.associations[associationName],
  //   });
  // });

  // This callback is mainly used to define scopes
  if ('afterModelsDefinition' in model) {
    model.afterModelsDefinition(db);
  }
});

// nodeTypeMapper.mapTypes(types);

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
