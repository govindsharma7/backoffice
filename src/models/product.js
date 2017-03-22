module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define('Product', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    label: {
      type:                     DataTypes.STRING,
      required: true,
    },
    price: {
      type:                     DataTypes.FLOAT,
      required: false,
    },
  });

  Product.afterLianaInit = (models) => {
    Product.hasMany(models.OrderItem);
  };

  return Product;
};
