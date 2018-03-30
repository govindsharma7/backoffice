const { DataTypes }         = require('sequelize');
const sequelize             = require('./sequelize');

const TotalPaid = sequelize.define('TotalPaid', {
  OrderId: {
    primaryKey: true,
    type:                     DataTypes.UUID,
  },
  totalPaid: {
    type:                     DataTypes.INTEGER,
  },
}, {
  timestamps: false,
});

TotalPaid.isView = true;
TotalPaid.sync = async function({ logging }) {
  // Sync only happens during deploy. So it's okay to drop/create view on
  // every sync (DROP OR REPLACE doesn't work with sqlite).
  await sequelize.query('DROP VIEW IF EXISTS `TotalPaid`', { logging });

  // query from https://stackoverflow.com/questions/612231/how-can-i-select-rows-with-maxcolumn-value-distinct-by-another-column-in-sql
  return sequelize.query([
    'CREATE VIEW `TotalPaid` AS',
    'SELECT `Payment`.`OrderId`, IFNULL(SUM(`Payment`.`amount`), 0) AS totalPaid',
    'FROM `Payment`',
    'WHERE `Payment`.`deletedAt` IS NULL',
    'GROUP BY `Payment`.`OrderId`',
  ].join(' '), { logging });
};

TotalPaid.drop = function ({ logging }) {
  return sequelize.query('DROP VIEW IF EXISTS `TotalPaid`', { logging });
};

TotalPaid.associate = (models) => {
  TotalPaid.belongsTo(models.Order, {
    foreignKey: 'OrderId',
    constraints: false,
  });
};

module.exports = TotalPaid;
