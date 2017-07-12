const {TRASH_SCOPES} = require('../../const');
const Utils          = require('../../utils');
const collection     = require('./collection');

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
      allowNull: false,
    },
    reason: {
      type:                     DataTypes.STRING,
      require: false,
    },
    paylineId: {
      type:                     DataTypes.STRING,
    },
    status: {
      type:                     DataTypes.ENUM('draft', 'active'),
      required: true,
      defaultValue: 'active',
      allowNull: false,
    },
  }, {
    paranoid: true,
    scopes: TRASH_SCOPES,
  });
  const {models} = sequelize;

  Credit.associate = () => {
    Credit.belongsTo(models.Payment, {
      constraints: false,
    });
    Credit.belongsTo(models.Order, {
      constraints: false,
    });

    Credit.addScope('order', {
      include: [{
        model: models.Payment,
      }],
    });
  };

  Credit.beforeLianaInit = (app) => {
    Utils.addRestoreAndDestroyRoutes(app, Credit);
  };

  Credit.collection = collection;

  return Credit;
};
