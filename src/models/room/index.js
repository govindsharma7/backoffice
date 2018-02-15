const { DataTypes }     = require('sequelize');
const Promise           = require('bluebird');
const D                 = require('date-fns');
const { TRASH_SCOPES }  = require('../../const');
const Utils             = require('../../utils');
const sequelize         = require('../sequelize');
const models            = require('../models'); //!\ Destructuring forbidden /!\
const collection        = require('./collection');
const routes            = require('./routes');
const hooks             = require('./hooks');

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
  // WATCH OUT: only meaningful when availableAt scope is used
  availableAt: {
    type:                   DataTypes.VIRTUAL(DataTypes.DATE),
    get() {
      const { availableAt } = this.dataValues;

      return availableAt == null || typeof availableAt == 'object' ?
        availableAt : Utils.parseDBDate(availableAt);
    },
  },
  // WATCH OUT: only meaningful when apartment and availableAt scopes are used
  currentPrice: {
    type:                   DataTypes.VIRTUAL(DataTypes.INTEGER),
    async get() {
      if ( this.availableAt == null ) {
        return Promise.resolve(null);
      }

      const [periodCoef, serviceFees] = await Promise.all([
        Utils.getPeriodCoef(D.max(new Date(), this.availableAt)),
        Utils.getServiceFees({ apartment: this.Apartment }),
      ]);

      return Utils.getPeriodPrice( this.basePrice, periodCoef, serviceFees );
    },
  },
  // WATCH OUT: only meaningful when apartment scope is used
  serviceFees: {
    type:                   DataTypes.VIRTUAL(DataTypes.INTEGER),
    get() {
      return Utils.getServiceFees({ apartment: this.Apartment });
    },
  },
}, {
  paranoid: true,
  scopes: TRASH_SCOPES,
});

Room.associate = (models) => {
  Room.belongsTo(models.Apartment);
  Room.hasMany(models.Renting);
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
    attributes: { include: [
      [sequelize.literal('`Rentings->Events`.`startDate`'), 'availableAt'],
    ]},
    include: [{
      model: models.Renting.scope({ method: ['latestRenting', 'Rentings'] }),
      required: false,
    }],
  });
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
