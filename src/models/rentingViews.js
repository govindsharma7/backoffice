// This is how you use views with Sequelize, from https://github.com/sequelize/sequelize/issues/7197
const { DataTypes }         = require('sequelize');
const map                   = require('lodash/map');
const sequelize             = require('./sequelize');

const _ = { map };
const views = {
  'LatestRenting': {
    foreignKey: 'RoomId',
  },
  'CurrentRenting': {
    foreignKey: 'RoomId',
    isCurrent: true,
  },
  'LatestRentingByClient': {
    foreignKey: 'ClientId',
  },
  CurrentRentingByClient: {
    foreignKey: 'ClientId',
    isCurrent: true,
  },
};
const [
  LatestRenting,
  CurrentRenting,
] = _.map(views, ({ foreignKey, isCurrent }, viewName) => {
  const View = sequelize.define(viewName, {
    RoomId: {
      primaryKey: true,
      type:                     DataTypes.UUID,
    },
    bookingDate: {
      primaryKey: true,
      type:                     DataTypes.DATE,
    },
  }, {
    timestamps: false,
  });

  View.isView = true;
  View.sync = async function({ logging }) {
    // Sync only happens during deploy. So it's okay to drop/create view on
    // every sync (DROP OR REPLACE doesn't work with sqlite).
    await sequelize.query(`DROP VIEW IF EXISTS \`${viewName}\``, { logging });

    // query from https://stackoverflow.com/questions/612231/how-can-i-select-rows-with-maxcolumn-value-distinct-by-another-column-in-sql
    return sequelize.query([
      `CREATE VIEW \`${viewName}\` AS`,
      'SELECT',
        `\`Renting\`.\`${foreignKey}\`,`,
        'MAX(`Renting`.`bookingDate`) AS bookingDate',
      'FROM `Renting`',
      'WHERE `Renting`.`deletedAt` IS NULL AND `Renting`.`status` = \'active\'',
      isCurrent ? 'AND `Renting`.`bookingDate` <= CURRENT_TIMESTAMP' : '',
      `GROUP BY \`Renting\`.\`${foreignKey}\``,
    ].join(' '), { logging });
  };

  View.drop = function ({ logging }) {
    return sequelize.query(`DROP VIEW IF EXISTS \`${viewName}\``, { logging });
  };

  View.associate = (models) => {
    View.hasMany(models.Renting, {
      foreignKey,
      constraints: false,
    });
  };

  return View;
});

module.exports = {
  LatestRenting,
  CurrentRenting,
};
