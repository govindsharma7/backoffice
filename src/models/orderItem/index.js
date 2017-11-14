const { DataTypes }     = require('sequelize');
const { TRASH_SCOPES }  = require('../../const');
const sequelize         = require('../sequelize');
const collection        = require('./collection');
const routes            = require('./routes');
const hooks             = require('./hooks');

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
    defaultValue: '0',
    // required: true,
    // allowNull: false,
    get() {
      return parseFloat(this.getDataValue('vatRate'));
    },
  },
  status: {
    type:                     DataTypes.ENUM('draft', 'active'),
    defaultValue: 'active',
    // required: true,
    // allowNull: false,
  },
}, {
  paranoid: true,
  scopes: Object.assign({}, TRASH_SCOPES/*, UNTRASHED_SCOPE*/),
});

OrderItem.associate = (models) => {
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

OrderItem.collection = collection;
OrderItem.routes = routes;
OrderItem.hooks = hooks;

module.exports = OrderItem;
