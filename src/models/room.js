const Promise          = require('bluebird');
const D                = require('date-fns');
const Utils            = require('../utils');
const {TRASH_SCOPES}   = require('../const');

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
    name:                       DataTypes.STRING,
    floorArea:                  DataTypes.FLOAT,
    basePrice:                  DataTypes.FLOAT,
    status: {
      type:                     DataTypes.ENUM('draft', 'active'),
      required: true,
      defaultValue: 'active',
    },
    latestBookingDate: {
      type:                     DataTypes.VIRTUAL,
      get() {
        return D.parse(this.dataValues.latestBookingDate);
      },
    },
    latestCheckoutDate: {
      type:                     DataTypes.VIRTUAL,
      get() {
        return D.parse(this.dataValues.latestCheckoutDate);
      },
    },
  }, {
    paranoid: true,
    scopes: TRASH_SCOPES,
  });
  const {models} = sequelize;

  Room.associate = () => {
    Room.belongsTo(models.Apartment);
    Room.hasMany(models.Renting);

    Room.addScope('latestRenting', {
      attributes: { include: [
        [sequelize.col('Rentings.id'), 'latestRentingId'],
        [sequelize.col('Rentings->Events.startDate'), 'latestCheckoutDate'],
        [sequelize.fn('max', sequelize.col('Rentings.bookingDate')), 'latestBookingDate'],
      ]},
      include: [{
        model: models.Renting,
        attributes: [],
        include: [{
          model: models.Event,
          attributes: [],
          required: false,
          include: [{
            model: models.Term,
            attributes: [],
            where: {
              taxonomy: 'event-category',
              name: 'checkout',
            },
          }],
        }],
      }],
      group: ['Room.id'],
    });

    Room.addScope('roomCount', {
      attributes: { include: [
        [sequelize.fn('count', sequelize.col('Apartment->Rooms.id')), 'roomCount'],
      ]},
      include: [{
        model: models.Apartment,
        attributes: [],
        include: [{
          model: models.Room,
          attributes: [],
        }],
      }],
      group: ['Room.id'],
    });
  };

  // calculate periodPrice and serviceFees for the room
  Room.prototype.getCalculatedProps = function(date = Date.now()) {
    return Promise.all([
        Utils.getPeriodPrice(this.basePrice, date),
        Utils.getServiceFees(this.get('roomCount')),
      ])
      .then(([periodPrice, serviceFees]) => {
        return { periodPrice, serviceFees };
      });
  };

  return Room;
};
