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
    },
    price: {
      type:                     DataTypes.INTEGER,
      required: false,
    },
  });
  const {models} = sequelize;

  Product.associate = () => {
    Product.hasMany(models.OrderItem);
  };

  return Product;
};
