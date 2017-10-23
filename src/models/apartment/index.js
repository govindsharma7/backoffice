const Geocode                     = require('../../vendor/geocode');
const {TRASH_SCOPES}              = require('../../const');
const collection                  = require('./collection');
const routes                      = require('./routes');
const hooks                       = require('./hooks');

module.exports = (sequelize, DataTypes) => {
  const Apartment = sequelize.define('Apartment', {
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
    addressStreet:            DataTypes.STRING,
    addressZip:               DataTypes.STRING,
    addressCity:              DataTypes.ENUM('lyon', 'montpellier', 'paris'),
    addressCountry:           DataTypes.ENUM('france'),
    code:                     DataTypes.STRING,
    floor:                    DataTypes.INTEGER,
    roomCount:                DataTypes.INTEGER,
    latLng:                   DataTypes.STRING,
    floorArea:                DataTypes.FLOAT,
    status: {
      type:                   DataTypes.ENUM('draft', 'active'),
      defaultValue: 'active',
      // required: true,
      // allowNull: false,
    },
    district:                 DataTypes.STRING,
    descriptionEn:            DataTypes.TEXT,
    descriptionFr:            DataTypes.TEXT,
    elevator:                 DataTypes.BOOLEAN,
    floorPlan:                DataTypes.STRING,
  }, {
    paranoid: true,
    scopes: Object.assign({
      lyon: {
        where: {
          addressCity: 'lyon',
        },
      },
      paris: {
        where: {
          addressCity: 'paris',
        },
      },
      montpellier: {
        where: {
          addressCity: 'montpellier',
        },
      },
    }, TRASH_SCOPES),
  });
  const {models} = sequelize;

  Apartment.associate = () => {
    Apartment.hasMany(models.Room);
    Apartment.hasMany(models.Picture, {
      foreignKey: 'PicturableId',
      constraints: false,
      scope: { picturable: 'Apartment' },
    });
    Apartment.hasMany(models.Term, {
      foreignKey: 'TermableId',
      constraints: false,
      scope: { termable: 'Apartment' },
    });

    Apartment.addScope('_roomCount', {
      attributes: { include: [
        [sequelize.fn('count', sequelize.col('Rooms.id')), '_roomCount'],
      ]},
      include: [{
        model: models.Room,
        attributes: [],
      }],
      group: ['Apartment.id'],
    });
  };

  Apartment.prototype.calculateLatLng = function(addressValues = this.dataValues) {
    return Geocode([
        addressValues.addressStreet,
        addressValues.addressZip,
        addressValues.addressCountry,
      ].join(','))
      .then(({lat, lng}) => {
        this.set('latLng', `${lat},${lng}`);
        return this;
      });
  };

  Apartment.collection = collection;
  Apartment.routes = routes;
  Apartment.hooks = hooks;

  return Apartment;
};
