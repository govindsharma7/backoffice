module.exports = (sequelize, DataTypes) => {
  const Charge = sequelize.define('Charge', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    amount: {
      type:                     DataTypes.DATE,
      required: true,
    },
  });

  Charge.associate = (models) => {
    Charge.belongsTo(models.Order);
  };

  return Charge;
};
