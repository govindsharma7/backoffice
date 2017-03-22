module.exports = (sequelize, DataTypes) => {
  const Renting = sequelize.define('Renting', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    checkinDate: {
      type:                     DataTypes.DATEONLY,
      required: true,
    },
    checkoutDate:  {
      type:                     DataTypes.DATEONLY,
      required: false,
    },
    price: {
      type:                     DataTypes.FLOAT,
      required: true,
    },
  });

  Renting.afterLianaInit = (models) => {
    Renting.belongsTo(models.Client);
    Renting.belongsTo(models.Room);
    Renting.hasMany(models.OrderItem);
  };

  return Renting;
};
