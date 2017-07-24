const Promise          = require('bluebird');
const D                = require('date-fns');
const Utils            = require('../../utils');
const {TRASH_SCOPES}   = require('../../const');
const collection       = require('./collection');
const routes           = require('./routes');

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
      allowNull: false,
    },
    latestBookingDate: {
      type:                     DataTypes.VIRTUAL(DataTypes.DATE),
      get() {
        return D.parse(this.dataValues.latestBookingDate);
      },
    },
    latestCheckoutDate: {
      type:                     DataTypes.VIRTUAL(DataTypes.DATE),
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
      include: [{
        model: models.Renting,
        required: false,
        include: [{
          model: models.Event,
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
      }, {
        model: models.Apartment,
      }],
    });

  };
  // calculate periodPrice and serviceFees for the room
  Room.prototype.getCalculatedProps = function(date = Date.now()) {
    return Promise.all([
        Utils.getPeriodCoef(date),
        // For some reason, Forest sometimes triggers calls to getCalculatedProps
        // and doesn't load the appropriate scope.
        // TODO: find when/why that happens and implement a real fix
        this.Apartment ? Utils.getServiceFees(this.Apartment.roomCount) : 0,
      ])
      .then(([periodCoef, serviceFees]) => {
        return {
          periodPrice: Utils.getPeriodPrice( this.basePrice, periodCoef, serviceFees ),
          serviceFees,
        };
      });
  };

  Room.collection = collection;
  Room.routes = routes;

  return Room;
};
