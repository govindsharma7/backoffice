const Sequelize   = require('sequelize');
const config      = require('../config');
const apartment   = require('./apartment');
const client      = require('./client');
const credit      = require('./credit');
const event       = require('./event');
const metadata    = require('./metadata');
const order       = require('./order');
const orderItem   = require('./orderItem');
const payment     = require('./payment');
const picture     = require('./picture');
const product     = require('./product');
const renting     = require('./renting');
const room        = require('./room');
const setting     = require('./setting');
const term        = require('./term');

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

// Load the models manually (loading the directory isn't webpack friendly)
const db = {
  Apartment: apartment(sequelize, Sequelize.DataTypes),
  Client: client(sequelize, Sequelize.DataTypes),
  Credit: credit(sequelize, Sequelize.DataTypes),
  Event: event(sequelize, Sequelize.DataTypes),
  Metadata: metadata(sequelize, Sequelize.DataTypes),
  Order: order(sequelize, Sequelize.DataTypes),
  OrderItem: orderItem(sequelize, Sequelize.DataTypes),
  Payment: payment(sequelize, Sequelize.DataTypes),
  Picture: picture(sequelize, Sequelize.DataTypes),
  Product: product(sequelize, Sequelize.DataTypes),
  Renting: renting(sequelize, Sequelize.DataTypes),
  Room: room(sequelize, Sequelize.DataTypes),
  Setting: setting(sequelize, Sequelize.DataTypes),
  Term: term(sequelize, Sequelize.DataTypes),
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

Object.keys(db).forEach(function(modelName) {
  if ('associate' in db[modelName]) {
    db[modelName].associate(db);
  }

  if ('hooks' in db[modelName]) {
    db[modelName].hooks(db, db[modelName]);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
