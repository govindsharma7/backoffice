const Promise          = require('bluebird');
const Utils            = require('../../utils');
const {
  TRASH_SCOPES,
  UNAVAILABLE_DATE,
}                      = require('../../const');
const collection       = require('./collection');
const routes           = require('./routes');

module.exports = (sequelize, DataTypes) => {
  const {models} = sequelize;
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
      'double', 'simple', 'sofa', 'double+sofa', 'simple+sofa', 'simple+simple'
    ),
    status: {
      type:                   DataTypes.ENUM('draft', 'active'),
      defaultValue: 'active',
      // required: true,
      // allowNull: false,
    },
    availableAt: {
      type:                   DataTypes.VIRTUAL(DataTypes.DATE),
      get() {
        return this.Rentings && ( this.Rentings.length === 0 ?
          new Date() :
          models.Renting.getLatest(this.Rentings).get('checkoutDate') || UNAVAILABLE_DATE
        );
      },
    },
  }, {
    paranoid: true,
    scopes: TRASH_SCOPES,
  });

  Room.associate = () => {
    const availableAt = {
      model: models.Renting.scope('checkoutDate'),
      required: false,
      attributes: { include: [
        [sequelize.literal('`Rentings->Events`.`startDate`'), 'checkoutDate'],
      ]},
      where: { status: 'active' },
    };
    const apartment = {
      model: models.Apartment,
    };

    Room.belongsTo(models.Apartment);
    Room.hasMany(models.Renting);

    Room.addScope('apartment', {
      include: [apartment],
    });

    Room.addScope('availableAt', {
      include: [availableAt],
    });

    Room.addScope('apartment+availableAt', {
      include: [apartment, availableAt],
    });
  };

  // calculate periodPrice and serviceFees for the room
  Room.prototype.getCalculatedProps = function(now = new Date()) {
    return Promise.all([
        Utils.getPeriodCoef(now),
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

  Room.prototype.checkAvailability = function(date = new Date()) {
    return Room.checkAvailability(this, date);
  };
  Room.checkAvailability = function(room, date = new Date()) {
    if ( room.Rentings.length === 0 ) {
      return Promise.resolve(true);
    }

    const checkoutDate =
      models.Renting.getLatest(room.Rentings).get('checkoutDate');

    return Promise.resolve( checkoutDate && checkoutDate <= date ? true : false );
  };

  Room.collection = collection;
  Room.routes = routes;

  return Room;
};
