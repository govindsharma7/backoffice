const { DataTypes }   = require('sequelize');
const Promise         = require('bluebird');
const D               = require('date-fns');
const {
  TRASH_SCOPES,
  UNAVAILABLE_DATE,
}                     = require('../../const');
const Utils           = require('../../utils');
const sequelize       = require('../sequelize');
const models          = require('../models'); //!\ Destructuring forbidden /!\
const collection      = require('./collection');
const routes          = require('./routes');
const hooks           = require('./hooks');

const { required } = Utils;

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
  descriptionEn:            DataTypes.TEXT,
  descriptionFr:            DataTypes.TEXT,
  descriptionEs:            DataTypes.TEXT,
  availableAt: {
    type:                   DataTypes.VIRTUAL(DataTypes.DATE),
    get() {
      return this.Rentings && ( this.Rentings.length === 0 ?
        new Date(0) :
        models.Renting.getLatest(this.Rentings).get('checkoutDate') || UNAVAILABLE_DATE
      );
    },
  },
  roomNumber: {
    type:                   DataTypes.VIRTUAL(DataTypes.INTEGER),
  },
}, {
  paranoid: true,
  scopes: TRASH_SCOPES,
});

Room.associate = (models) => {
  const { fn, col } = sequelize;
  // /!\ this scope doesn't give the availability date directly, only the
  // checkout date for each renting of the room
  const availableAt = {
    model: models.Renting.scope('checkoutDate'),
    required: false,
    attributes: { include: [
      [sequelize.literal('`Rentings->Events`.`startDate`'), 'checkoutDate'],
    ]},
    where: { status: 'active' },
  };

  Room.belongsTo(models.Apartment);
  Room.hasMany(models.Renting);
  Room.hasMany(models.LatestRenting, {
    foreignKey: 'RoomId',
    constraints: false,
  });
  Room.hasMany(models.Picture, {
    foreignKey: 'PicturableId',
    constraints: false,
    scope: { picturable: 'Room' },
  });
  Room.hasMany(models.Term, {
    foreignKey: 'TermableId',
    constraints: false,
    scope: { termable: 'Room' },
  });
  Room.hasMany(models.Metadata, {
    foreignKey: 'MetadatableId',
    constraints: false,
    scope: { metadatable: 'Room' },
  });

  Room.addScope('availableAt', {
    include: [availableAt],
  });

  Room.addScope('latestHousemates', {
    attributes:  [
      'name',
      'id',
      [fn('max', col('Rentings.bookingDate')), 'latestBookingDate'],
    ],
    include: [{
      model: models.LatestRenting,
      attributes: ['id'],
      where: {
        status: 'active',
      },
      required: false,
      include: [{
        model: models.Client,
        attributes: ['id', 'firstName', 'lastName'],
        required: false,
      }, {
        model: models.Event,
        attributes: ['id', 'startDate'],
        required: false,
        include:[{
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

  Room.addScope('apartment+availableAt', {
    include: [{ model: models.Apartment }, availableAt],
  });
};


// calculate periodPrice and serviceFees for the room
Room.prototype.getCalculatedProps = function(now = new Date()) {
  return Room.getCalculatedProps(
    this.basePrice,
    this.Apartment && this.Apartment.roomCount,
    now
  );
};
Room.getCalculatedProps = async function(basePrice, roomCount, now = new Date()) {
  const [periodCoef, serviceFees] = await Promise.all([
    Utils.getPeriodCoef(now),
    Utils.getServiceFees(roomCount),
  ]);

  return {
    periodPrice: Utils.getPeriodPrice( basePrice, periodCoef, serviceFees ),
    serviceFees,
  };
};

Room.prototype.checkAvailability = function(args) {
  return Room.checkAvailability(Object.assign({ room: this }, args));
};
Room.checkAvailability = function({ rentings = required(), date = new Date() }) {
  if ( rentings.length === 0 ) {
    return Promise.resolve(true);
  }

  const checkoutDate = models.Renting.getLatest(rentings).get('checkoutDate');

  return Promise.resolve( checkoutDate && checkoutDate <= date ? true : false );
};

Room.prototype.getEarliestAvailability = function(args) {
  return Room.getEarliestAvailability(args);
};
Room.getEarliestAvailability = function({ rentings = required(), now = new Date() }) {
  if ( rentings.length === 0 ) {
    return Promise.resolve(now);
  }

  const checkoutDate = models.Renting.getLatest(rentings).get('checkoutDate');
  const daysToAdd = checkoutDate && ( D.isSaturday(checkoutDate) ? 2 : 1 );
  const availabilityDate = checkoutDate && D.addDays(checkoutDate, daysToAdd);

  return Promise.resolve( checkoutDate ? D.max(availabilityDate, now) : false );
};

// Make a room unavailable for a period of time (from and to included)
Room.prototype.createMaintenancePeriod = function({ from, to }) {
  return models.Renting
    .create({
      bookingDate: from,
      status: 'active',
      ClientId: 'maintenance',
      RoomId: this.id,
      Events: to ? [{
        startDate: to,
        endDate: to,
        eventable: 'Renting',
        summary: 'End of maintenance',
        description: `${this.name}`,
        type: 'checkout',
      }] : [],
    }, {
    include: [models.Event],
  });
};

Room.collection = collection;
Room.routes = routes;
Room.hooks = hooks;

module.exports = Room;
