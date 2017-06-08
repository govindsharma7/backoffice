const {TRASH_SCOPES} = require('../const');

module.exports = (sequelize, DataTypes) => {
  // const {models} = sequelize;
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
      require: true,
      allowNull: false,
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

  Credit.rawAssociations = [
    { belongsTo: 'Payment', options:  {
      constraints: false,
    }},
    { belongsTo: 'Order', options:  {
      constraints: false,
    }},
  ];

  return Credit;
};
