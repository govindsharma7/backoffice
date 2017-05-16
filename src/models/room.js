const Promise          = require('bluebird');
const Utils            = require('../utils');
const {TRASH_SCOPES} = require('../const');

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
    scopes: TRASH_SCOPES,
  });
  const {models} = sequelize;

  Room.associate = () => {
    Room.belongsTo(models.Apartment);
    Room.hasMany(models.Renting);

    // Room.addScope('availability', {
    //   include: [{
    //     model: models.Renting,
    //   }],
    //   group: ['Room.id'],
    //   order: [
    //     []
    //   ]
    // });
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

  // For now, this method is mainly used to test 'available' scope
  Room.findAllAvailability = function(options) {
    return Room.scope('availability').findAll(options);
  };

  return Room;
};
