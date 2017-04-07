module.exports = (sequelize, DataTypes) => {
  const OrderItem = sequelize.define('OrderItem', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    quantity: {
      type:                     DataTypes.FLOAT, // can be a fraction
      defaultValue: 1,
      required: false,
    },
    amount: {
      type:                     DataTypes.INTEGER,
      required: false,
    },
  });

  OrderItem.associate = (models) => {
    OrderItem.belongsTo(models.Order);
    OrderItem.belongsTo(models.Renting, {
      constraints: false,
    });
    OrderItem.belongsTo(models.Product, {
      constraints: false,
    });
  };

  return OrderItem;
};
