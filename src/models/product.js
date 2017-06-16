const Liana          = require('forest-express');
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
    const LEA = Liana.ensureAuthenticated;

    app.post('/forest/actions/restore-product', LEA, (req, res) => {
      Product
        .findAll({
          where: { id: { $in: req.body.data.attributes.ids } },
          paranoid: false,
        })
        .then((products) => {
          return Utils.restore(products);
        })
        .then((value) => {
          return Utils.restoreSuccessHandler(res, `${value} Products`);
        })
        .catch(Utils.logAndSend(res));
    });

    app.post('/forest/actions/destroy-product', LEA, (req, res) => {
      Product
        .findAll({
          where: { id: { $in: req.body.data.attributes.ids } },
          paranoid: false,
        })
        .then((products) => {
          return Utils.destroy(products);
        })
        .then((value) => {
          return Utils.destroySuccessHandler(res, `${value} Products`);
        })
        .catch(Utils.logAndSend(res));
    });
  };
  return Product;
};
