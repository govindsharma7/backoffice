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
  const {models} = sequelize;

  Credit.associate = () => {
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
        // TODO: why is Payment.orderId wrapped in $?
        where: {'$Payment.OrderId$' : orderId},
        include: [{
          model: models.Payment,
          attributes: ['id', 'OrderId'],
          // TODO: is this include really necessary?
          include: [{
            model: models.Order,
            attributes: ['id'],
          }],
        }],
      });
  };

  return Credit;
};
