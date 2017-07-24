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
    roomCount: {
      type:                   DataTypes.INTEGER,
      required: true,
      allowNull: false,
    },
    latLng:                   DataTypes.STRING,
    floorArea:                DataTypes.FLOAT,
    status: {
      type:                   DataTypes.ENUM('draft', 'active'),
      required: true,
      allowNull: false,
      defaultValue: 'active',
    },
    district:                 DataTypes.STRING,
  }, {
    paranoid: true,
    scopes: TRASH_SCOPES,
  });
  const {models} = sequelize;

  Apartment.associate = () => {
    Apartment.hasMany(models.Room);

    ['lyon', 'paris', 'montpellier'].forEach((name) => {
      Apartment.addScope(name, {
        where: { addressCity: name },
      });
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
