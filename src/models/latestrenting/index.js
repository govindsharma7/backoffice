const { DataTypes }         = require('sequelize');
const sequelize             = require('../sequelize');

// This is how you use views with Sequelize, from https://github.com/sequelize/sequelize/issues/7197
const LatestRenting = sequelize.define('LatestRenting', {
  RoomId: {
    primaryKey: true,
    type:                     DataTypes.UUID,
  },
  bookingDate: {
    primaryKey: true,
    type:                     DataTypes.DATE,
  },
}, {
  tableName: 'LatestRentingView',
  timestamps: false,
});

LatestRenting.sync = async function({ logging }) {
  // query from https://stackoverflow.com/questions/612231/how-can-i-select-rows-with-maxcolumn-value-distinct-by-another-column-in-sql
  try {
    await sequelize.query([
      'CREATE VIEW `LatestRentingView` AS',
      'SELECT',
        '`Renting`.`RoomId`, MAX(`Renting`.`bookingDate`) AS bookingDate,',
        // For some reason we couldn't prevent Sequelize to look for an id :-(
        '\'ZOB\' AS id',
      'FROM `Renting`',
      'WHERE `Renting`.`status` = \'active\' AND `Renting`.`deletedAt` IS NULL',
      'GROUP BY `Renting`.`RoomId`',
    ].join(' '), { logging });
  }
  catch (e) {
    // Ignore view creation failure when it already exists
    if ( !/table .*? already exists/i.test(e) ) {
      throw e;
    }
  }
};

LatestRenting.drop = function ({ logging }) {
  return sequelize.query('DROP VIEW IF EXISTS `LatestRentingView`', { logging });
};

LatestRenting.associate = (models) => {
  LatestRenting.hasMany(models.Renting, {
    foreignKey: 'RoomId',
    constraints: false,
  });
  LatestRenting.belongsTo(models.Room, {
    foreignKey: 'id',
    constraints: false,
  });
};

module.exports = LatestRenting;
