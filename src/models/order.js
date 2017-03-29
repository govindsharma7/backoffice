module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define('Order', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    label: {
      type:                     DataTypes.STRING,
      required: true,
    },
    invoiceRef: {
      type:                     DataTypes.STRING,
      unique: true,
    },
  });

  Order.associate = (models) => {
    Order.hasMany(models.OrderItem);
    Order.belongsTo(models.Client);
    Order.hasMany(models.Charge);
  };

  return Order;
};
