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
      type:                     DataTypes.ENUM('draft', 'active', 'archived'),
      required: true,
      defaultValue: 'active',
    },
  });
  const {models} = sequelize;

  Product.associate = () => {
    Product.hasMany(models.OrderItem);
  };

  Product.beforeFind = (query) => {
    console.log(query);
    if (!('id' in query.where) && !('status' in query.where)) {
      if (query.where.$and) {
        const verif = query.where.$and.some((element) => {
          if (element.$and) {
            return element.$and.some((secondElement) => {
              return element.id ||
                element.status ||
                secondElement.id ||
                secondElement.status;
            });
          }
          return element.id || element.status;
        });

        if (!verif) {
          query.where.status = 'active';
        }
      }
      else {
        query.where.status = 'active';
      }
    }
  };

  Product.hook('beforeFind', Product.beforeFind);

  return Product;
};
