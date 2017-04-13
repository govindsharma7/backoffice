module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define('Payment', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    type: {
      type:                     DataTypes.ENUM('card', 'sepa', 'manual'),
      required: true,
      defaultValue: 'card',
    },
    amount: {
      type:                     DataTypes.INTEGER,
      required: true,
    },
  });

  Payment.associate = () => {
    const {models} = sequelize;

    Payment.belongsTo(models.Order);
  };

  return Payment;
};
