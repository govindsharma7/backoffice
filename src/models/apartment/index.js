const { DataTypes }               = require('sequelize');
const { TRASH_SCOPES }            = require('../../const');
const Geocode                     = require('../../vendor/geocode');
const sequelize                   = require('../sequelize');
const collection                  = require('./collection');
const routes                      = require('./routes');
const hooks                       = require('./hooks');

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
  descriptionEn:            DataTypes.TEXT,
  descriptionFr:            DataTypes.TEXT,
  descriptionEs:            DataTypes.TEXT,
  elevator:                 DataTypes.BOOLEAN,
}, {
  paranoid: true,
  scopes: Object.assign({
    lyon: {
      where: { addressCity: 'lyon' },
    },
    paris: {
      where: { addressCity: 'paris' },
    },
    montpellier: {
      where: { addressCity: 'montpellier' },
    },
  }, TRASH_SCOPES),
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
      ].join(',')
    )
    .then(({lat, lng}) => {
      this.set('latLng', `${lat},${lng}`);
      return this;
    });
};

Apartment.collection = collection;
Apartment.routes = routes;
Apartment.hooks = hooks;

module.exports = Apartment;
