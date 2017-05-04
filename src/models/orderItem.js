module.exports = (sequelize, DataTypes) => {
  const OrderItem = sequelize.define('OrderItem', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    label: {
      type:                     DataTypes.STRING,
      required:                 true,
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
      type:                     DataTypes.ENUM(0,0.2),
      required: true,
      defaultValue: 0,
      get: function() {
        return parseFloat(this.getDataValue('vatRate'));
      },
    },
  });

  OrderItem.associate = () => {
    const {models} = sequelize;

    OrderItem.belongsTo(models.Order);
    OrderItem.belongsTo(models.Renting, {
      constraints: false,
    });
    OrderItem.belongsTo(models.Product, {
      constraints: false,
    });
  };

  OrderItem.prototype.getAmount = function() {
    return Promise.resolve(
        this.unitPrice * this.quantity * ( 1 + this.vatRate )
    );
  };

  OrderItem.prototype.ninjaSerialize = function() {
    return Promise.resolve({
      'product_key': this.label,
      'cost': this.unitPrice,
      'qty': this.quantity,
    });
  };

  // Run Order's afterUpdate hook when an orderItem is updated
  OrderItem.hook('afterUpdate', (orderItem) => {
    const {Order} = sequelize.models;

    return orderItem
      .getOrder()
      .then(Order.afterUpdate);
  });

  return OrderItem;
};
