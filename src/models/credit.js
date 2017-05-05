module.exports = (sequelize, DataTypes) => {
  const Credit = sequelize.define('Credit', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    amount: {
      type:                     DataTypes.INTEGER,
      required: true,
    },
    reason: {
      type:                     DataTypes.STRING,
      require: false,
    },
    paylineId: {
      type:                     DataTypes.STRING,
      require: true,
    },
  });

  Credit.associate = () => {
    const {models} = sequelize;

    Credit.belongsTo(models.Payment, {
      constraints: false,
    });
    Credit.belongsTo(models.Order, {
      constraints: false,
    });
  };

  Credit.findRefundsFromOrder = (orderId) => {
    return Credit
      .findAll({
        where: {'$Payment.OrderId$' : orderId},
        include: [{
          model: sequelize.models.Payment,
          attributes: ['id', 'OrderId'],
          include: [{
            model: sequelize.models.Order,
            attributes: ['id'],
          }],
        }],
      });
  };

  return Credit;
};
