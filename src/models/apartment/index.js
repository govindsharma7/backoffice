const { DataTypes }               = require('sequelize');
const {
  TRASH_SCOPES,
  CITIES,
}                                 = require('../../const');
const Geocode                     = require('../../vendor/geocode');
const sequelize                   = require('../sequelize');
const collection                  = require('./collection');
const routes                      = require('./routes');
const hooks                       = require('./hooks');

const citiesScopes = CITIES.reduce(
  (acc, curr) => Object.assign(acc, { [curr]: { where: { addressCity: curr } } }),
  {}
);

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
  addressCity:              DataTypes.ENUM(CITIES),
  addressCountry:           DataTypes.ENUM('france'),
  code:                     DataTypes.STRING,
  floor:                    DataTypes.INTEGER,
  roomCount:                DataTypes.INTEGER,
  latLng:                   DataTypes.STRING,
  floorArea:                DataTypes.FLOAT,
  status: {
    type:                   DataTypes.ENUM('draft', 'active'),
    defaultValue: 'active',
    required: true,
  },
  descriptionEn:            DataTypes.TEXT,
  descriptionFr:            DataTypes.TEXT,
  descriptionEs:            DataTypes.TEXT,
  elevator:                 DataTypes.BOOLEAN,
}, {
  paranoid: true,
  scopes: Object.assign(citiesScopes, TRASH_SCOPES),
});

Apartment.associate = (models) => {
  Apartment.belongsTo(models.District, {
    constraints: false,
  });
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
  Apartment.hasMany(models.Metadata, {
    foreignKey: 'MetadatableId',
    constraints: false,
    scope: { metadatable: 'Apartment' },
  });
};

Apartment.prototype.calculateLatLng = function() {
  return Apartment.calculateLatLng({ apartment: this });
};
Apartment.calculateLatLng = async function({ apartment }) {
  const { addressStreet, addressZip, addressCountry } = apartment;
  const { lat, lng } =
    await Geocode(`${addressStreet}, ${addressZip}, ${addressCountry}`);

  apartment.latLng = `${lat},${lng}`;

  return apartment;
};

Apartment.collection = collection;
Apartment.routes = routes;
Apartment.hooks = hooks;

module.exports = Apartment;
