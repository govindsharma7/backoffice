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

  Product.associate = () => {
    const {models} = sequelize;

    Product.hasMany(models.OrderItem);
  };

  return Product;
};
