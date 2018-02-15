const Sendinblue    = require('../vendor/sendinblue');
const sequelize     = require('./sequelize');
const models        = require('./models');
const Apartment     = require('./apartment');
const Client        = require('./client');
const Credit        = require('./credit');
const District      = require('./district');
const Event         = require('./event');
const LatestRenting = require('./latestrenting');
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

Object.assign(models, {
  Apartment,
  Client,
  Credit,
  District,
  Event,
  LatestRenting,
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
});

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

// Sendinblue needs Metadata to be initialized before it can save messageIds
// in Metadata table
Sendinblue.init(models.Metadata);

module.exports = models;
