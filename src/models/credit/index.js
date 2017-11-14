const { DataTypes }   = require('sequelize');
const {TRASH_SCOPES}  = require('../../const');
const Utils           = require('../../utils');
const sequelize       = require('../sequelize');
const collection      = require('./collection');

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

Credit.associate = (models) => {
  Credit.belongsTo(models.Payment, {
    constraints: false,
  });
  Credit.belongsTo(models.Order, {
    constraints: false,
  });
};

Credit.collection = collection;
Credit.routes = (app) => {
  Utils.addRestoreAndDestroyRoutes(app, Credit);
};

module.exports = Credit;
