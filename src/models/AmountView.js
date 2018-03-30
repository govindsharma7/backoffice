const { DataTypes }         = require('sequelize');
const sequelize             = require('./sequelize');

const Amount = sequelize.define('Amount', {
  OrderId: {
    primaryKey: true,
    type:                     DataTypes.UUID,
  },
  amount: {
    type:                     DataTypes.INTEGER,
  },
}, {
  timestamps: false,
});

Amount.isView = true;
Amount.sync = async function({ logging }) {
  // Sync only happens during deploy. So it's okay to drop/create view on
  // every sync (DROP OR REPLACE doesn't work with sqlite).
  await sequelize.query('DROP VIEW IF EXISTS `Amount`', { logging });

  // query from https://stackoverflow.com/questions/612231/how-can-i-select-rows-with-maxcolumn-value-distinct-by-another-column-in-sql
  return sequelize.query([
    'CREATE VIEW `Amount` AS',
    'SELECT',
      '`OrderItem`.`OrderId`,',
      'IFNULL( SUM(',
        '`OrderItem`.`unitPrice` * `OrderItem`.`quantity` * (`OrderItem`.`vatRate` + 1)',
      '), 0) AS amount',
    'FROM `OrderItem`',
    'WHERE `OrderItem`.`deletedAt` IS NULL',
    'GROUP BY `OrderItem`.`OrderId`',
  ].join(' '), { logging });
};

Amount.drop = function ({ logging }) {
  return sequelize.query('DROP VIEW IF EXISTS `Amount`', { logging });
};

Amount.associate = (models) => {
  Amount.belongsTo(models.Order, {
    foreignKey: 'OrderId',
    constraints: false,
  });
};

module.exports = Amount;
