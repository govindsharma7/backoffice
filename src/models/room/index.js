const Promise          = require('bluebird');
const Utils            = require('../../utils');
const {TRASH_SCOPES}   = require('../../const');
const collection       = require('./collection');
const routes           = require('./routes');

module.exports = (sequelize, DataTypes) => {
  const Room = sequelize.define('Room', {
    id: {
      primaryKey: true,
      type:                   DataTypes.UUID,
      defaultValue:           DataTypes.UUIDV4,
    },
    reference: {
      type:                   DataTypes.STRING,
      unique: true,
    },
    name:                     DataTypes.STRING,
    floorArea:                DataTypes.FLOAT,
    basePrice:                DataTypes.FLOAT,
    beds:                     DataTypes.ENUM(
                                'double', 'simple', 'sofa', 'double+sofa', 'simple+sofa'
                              ),
    status: {
      type:                   DataTypes.ENUM('draft', 'active'),
      defaultValue: 'active',
      // required: true,
      // allowNull: false,
    },
  }, {
    paranoid: true,
    scopes: TRASH_SCOPES,
  });
  const {models} = sequelize;

  Room.associate = () => {
    Room.belongsTo(models.Apartment);
    Room.hasMany(models.Renting);

    Room.addScope('apartment', {
      include: [{
        model: models.Apartment,
      }],
    });

    Room.addScope('activeRenting+checkoutDate', {
      include: [{
        model: models.Renting,
        required: false,
        attributes: { include: [
          [sequelize.literal('`Rentings->Events`.`startDate`'), 'checkoutDate'],
        ]},
        where: { status: 'active' },
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

  Room.prototype.checkAvailability = function(date = Date.now()) {
    return Room.checkAvailability(this, date);
  };
  Room.checkAvailability = function(room, date = Date.now()) {
    if ( room.Rentings.length === 0 ) {
      return Promise.resolve(true);
    }

    const latestRenting = room.Rentings.reduce((acc, curr) => {
      return curr.bookingDate > acc.bookingDate ? curr : acc;
    }, room.Rentings[0]);
    const checkoutDate = latestRenting.get('checkoutDate');

    return Promise.resolve( checkoutDate && checkoutDate <= date ? true : false );
  };

  Room.collection = collection;
  Room.routes = routes;

  return Room;
};
