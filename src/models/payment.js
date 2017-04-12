module.exports = (sequelize, DataTypes) => {
  const Charge = sequelize.define('Charge', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    amount: {
      type:                     DataTypes.INTEGER,
      required: true,
    },
  });

  Charge.associate = () => {
    const {models} = sequelize;

    Charge.belongsTo(models.Order);
  };

  return Charge;
};
