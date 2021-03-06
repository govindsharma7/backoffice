const { DataTypes } = require('sequelize');
const sequelize     = require('../sequelize');
const collection    = require('./collection');
const routes        = require('./routes');
const hooks         = require('./hooks');

const Picture = sequelize.define('Picture', {
  id: {
    primaryKey: true,
    type:                 DataTypes.UUID,
    defaultValue:         DataTypes.UUIDV4,
  },
  url: {
    type:                 DataTypes.STRING,
    allowNull: false,
  },
  alt:                    DataTypes.STRING,
  order:                  DataTypes.INTEGER,
  PicturableId: {
    type:                 DataTypes.STRING,
    required: true,
    allowNull: false,
  },
  picturable: {
    type:                 DataTypes.STRING,
    required: true,
    allowNull: false,
  },
});

Picture.associate = (models) => {
  Picture.belongsTo(models.Apartment, {
    foreignKey: 'PicturableId',
    constraints: false,
    as: 'Apartment',
  });
  Picture.belongsTo(models.Room, {
    foreignKey: 'PicturableId',
    constraints: false,
    as: 'Room',
  });
};

Picture.collection = collection;
Picture.routes = routes;
Picture.hooks = hooks;

module.exports = Picture;
