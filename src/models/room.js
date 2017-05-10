const Promise          = require('bluebird');
const Utils            = require('../utils');

module.exports = (sequelize, DataTypes) => {
  const Room = sequelize.define('Room', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    reference: {
      type:                     DataTypes.STRING,
      unique: true,
    },
    floorArea:                  DataTypes.FLOAT,
    basePrice:                  DataTypes.FLOAT,
    status: {
      type:                     DataTypes.ENUM('draft', 'active'),
      required: true,
      defaultValue: 'active',
    },
  }, {
    paranoid: true,
    scopes: {
      trashed: {
        attributes: ['id'],
        where: {
          deletedAt: { $not: null },
          status: { $ne: 'draft'},
        },
        paranoid: false,
      },
      draft: {
        attributes: ['id'],
        where: {
          deletedAt: { $not: null },
          status: 'draft',
        },
        paranoid: false,
      },
    },
  });
  const {models} = sequelize;

  Room.associate = () => {
    Room.belongsTo(models.Apartment);
    Room.hasMany(models.Renting);
  };

  // calculate periodPrice and serviceFees for the room
  Room.prototype.getCalculatedProps = function(date = Date.now()) {
    return Promise.all([
        Utils.getPeriodCoef(date),
        models.Room.count({
          where: { ApartmentId: this.ApartmentId },
        }),
      ])
      .then(([coef, roomCount]) => {
        return Promise.all([
          this.basePrice * coef,
          Utils.getServiceFees(roomCount),
        ]);
      })
      .then(([periodPrice, serviceFees]) => {
        return { periodPrice, serviceFees };
      });
  };

  return Room;
};
