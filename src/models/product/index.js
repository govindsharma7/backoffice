const { DataTypes }     = require('sequelize');
const { TRASH_SCOPES }  = require('../../const');
const Utils             = require('../../utils');
const sequelize         = require('../sequelize');
const collection        = require('./collection');

const Product = sequelize.define('Product', {
  id: {
    primaryKey: true,
    type:                     DataTypes.UUID,
    defaultValue:             DataTypes.UUIDV4,
  },
  name: {
    type:                     DataTypes.STRING,
    required: true,
    allowNull: false,
  },
  price: {
    type:                     DataTypes.INTEGER,
    required: false,
  },
  status: {
    type:                     DataTypes.ENUM('draft', 'active'),
    required: true,
    defaultValue: 'active',
    allowNull: false,
  },
}, {
  paranoid: true,
  scopes: TRASH_SCOPES,
});

Product.associate = (models) => {
  Product.hasMany(models.OrderItem);
};

Product.collection = collection;
Product.routes = (app) => {
  Utils.addRestoreAndDestroyRoutes(app, Product);
};

module.exports = Product;
