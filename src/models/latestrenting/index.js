const { DataTypes }         = require('sequelize');
const sequelize             = require('../sequelize');

// This is how you use views with Sequelize, from https://github.com/sequelize/sequelize/issues/7197
const LatestRenting = sequelize.define('LatestRenting', {
  id: {
    primaryKey: true,
    type:                     DataTypes.UUID,
  },
  bookingDate:                DataTypes.DATE,
  price:                      DataTypes.INTEGER,
  serviceFees:                DataTypes.INTEGER,
  // RoomId:                     DataTypes.UUID,
  // ClientId:                   DataTypes.UUID,
}, {
  tableName: 'LatestRentingView',
  classMethods: {
    sync({ logging }) {
      // query from https://stackoverflow.com/questions/612231/how-can-i-select-rows-with-maxcolumn-value-distinct-by-another-column-in-sql
      return sequelize.query([
        'CREATE VIEW `LatestRentingView` AS',
        'SELECT',
          '`Renting`.`id`, `Renting`.`bookingDate`,',
          '`Renting`.`ClientId`, `Renting`.`RoomId`',
        'FROM `Renting`',
          'INNER JOIN (',
            'SELECT `Renting`.`RoomId`, MAX(`Renting`.`bookingDate`) AS _bookingDate',
            'FROM `Renting`',
            'WHERE `Renting`.`status` = \'active\' AND `Renting`.`deletedAt` IS NULL',
            'GROUP BY `Renting`.`RoomId`',
          ') Latest',
          'ON `Renting`.`RoomId` = `Latest`.`RoomId`',
          'AND `Renting`.`bookingDate` = `Latest`.`_bookingDate`',
      ].join(' '), { logging });
    },
    drop({ logging }) {
      return sequelize.query('DROP VIEW IF EXISTS `LatestRentingView`', { logging });
    },
  },
});

LatestRenting.associate = (models) => {
  LatestRenting.belongsTo(models.Client, {
    foreignKey: 'id',
    constraints: false,
  });
  LatestRenting.belongsTo(models.Room, {
    foreignKey: 'id',
    constraints: false,
  });
  LatestRenting.hasMany(models.Metadata, {
    foreignKey: 'MetadatableId',
    constraints: false,
    scope: { metadatable: 'Renting' },
  });
};

module.exports = LatestRenting;
