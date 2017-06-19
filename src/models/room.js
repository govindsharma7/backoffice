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
      allowNull: false,
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

    Room.addScope('Room.Apartment', {
      include: [{
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

  Room.beforeLianaInit = (app) => {
    Utils.addInternalRelationshipRoute({
      app,
      sourceModel: Room,
      associatedModel: models.Client,
      routeName: 'current-client',
      scope: 'Client.currentApartment',
      where: (req) => {
        return { '$Rentings.RoomId$': req.params.recordId };
      },
    });

    Utils.addRestoreAndDestroyRoutes(app, Room);
  };

  return Room;
};
