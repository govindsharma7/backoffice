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
    status: {
      type:                     DataTypes.ENUM('draft', 'active'),
      required: true,
      defaultValue: 'active',
    },
  }, {
    paranoid: true,
    scopes: {
      trashed: {
        attributes: ['id'],
        where: {
          deletedAt: { $not: null },
          status: { $ne: 'draft'},
        },
        paranoid: false,
      },
      draft: {
        attributes: ['id'],
        where: {
          deletedAt: { $not: null },
          status: 'draft',
        },
        paranoid: false,
      },
    },
  });
  const {models} = sequelize;

  Product.associate = () => {
    Product.hasMany(models.OrderItem);
  };


  return Product;
};
