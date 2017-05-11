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
