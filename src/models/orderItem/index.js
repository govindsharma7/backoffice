const Promise          = require('bluebird');
const {
  TRASH_SCOPES,
  // UNTRASHED_SCOPE,
}                      = require('../../const');
const collection       = require('./collection');
const routes           = require('./routes');
const hooks            = require('./hooks');

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
    scopes: Object.assign({}, TRASH_SCOPES/*, UNTRASHED_SCOPE*/),
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
      status: this.status,
      RentingId: this.RentingId,
      ProductId: this.ProductId,
      OrderId: this.OrderId,
    });
  };

  OrderItem.prototype.ninjaSerialize = function() {
    return Promise.resolve({
      'product_key': this.label,
      'cost': this.unitPrice / 100,
      'qty': this.quantity,
      'notes': '', // Updating orders on InvoiceNinja will fail without this
    });
  };

  OrderItem.collection = collection;
  OrderItem.routes = routes;
  OrderItem.hooks = hooks;

  return OrderItem;
};
