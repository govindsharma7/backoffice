const Promise          = require('bluebird');
const Liana            = require('forest-express-sequelize');
const Utils            = require('../utils');
const {TRASH_SCOPES}   = require('../const');

module.exports = (sequelize, DataTypes) => {
  const OrderItem = sequelize.define('OrderItem', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    label: {
      type:                     DataTypes.STRING,
      required: true,
      allowNull: false,
    },
    quantity: {
      type:                     DataTypes.FLOAT, // can be a fraction
      defaultValue: 1,
      required: false,
    },
    unitPrice: {
      type:                     DataTypes.INTEGER,
      required: false,
    },
    vatRate: {
      type:                     DataTypes.ENUM('0', '0.2'),
      required: true,
      defaultValue: '0',
      allowNull: false,
      get() {
        return parseFloat(this.getDataValue('vatRate'));
      },
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

  OrderItem.associate = () => {
    OrderItem.belongsTo(models.Order);
    OrderItem.belongsTo(models.Renting, {
      constraints: false,
    });
    OrderItem.belongsTo(models.Product, {
      constraints: false,
    });
    OrderItem.hasMany(models.Term, {
      foreignKey: 'TermableId',
      constraints: false,
      scope: { termable: 'OrderItem' },
    });
  };

  OrderItem.prototype.createDiscount = function(amount) {
    return OrderItem.create({
      label: 'Discount',
      unitPrice: -1 * amount,
      RentingId: this.RentingId,
      ProductId: this.ProductId,
    });
  };

  OrderItem.prototype.ninjaSerialize = function() {
    return Promise.resolve({
      'product_key': this.label,
      'cost': this.unitPrice / 100,
      'qty': this.quantity,
    });
  };

  // Run Order's afterUpdate hook when an orderItem is updated
  OrderItem.hook('afterUpdate', (orderItem) => {
    return orderItem
      .getOrder()
      .then(models.Order.afterUpdate);
  });

  OrderItem.beforeLianaInit = (app) => {
    const LEA = Liana.ensureAuthenticated;

    app.post('/forest/actions/add-discount', LEA, (req, res) => {
      const {ids, values} = req.body.data.attributes;

      Promise.resolve()
        .then(() => {
          if ( ids.length > 1 ) {
            throw new Error('Can\'t create multiple discounts');
          }

          return OrderItem.findById(ids[0]);
        })
        .then((orderItem) => {
          return orderItem.createDiscount(100 * values.discount);
        })
        .then(() => {
          return res.status(200).send({success: 'Discount created'});
        })
        .catch(Utils.logAndSend(res));
    });
  };

  return OrderItem;
};
