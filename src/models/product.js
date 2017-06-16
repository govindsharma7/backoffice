const {TRASH_SCOPES} = require('../const');
const Utils          = require('../utils');

module.exports = (sequelize, DataTypes) => {
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
  const {models} = sequelize;

  Product.associate = () => {
    Product.hasMany(models.OrderItem);
  };

  Product.beforeLianaInit = (app) => {
    Utils.restoreAndDestroyRoutes(app, Product);
  };
  return Product;
};
