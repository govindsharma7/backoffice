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
    status: {
      type:                     DataTypes.ENUM('draft', 'active', 'archived'),
      required: true,
      defaultValue: 'active',
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

  Credit.beforeFind = (query) => {
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

  Credit.hook('beforeFind', Credit.beforeFind);

  return Credit;
};
