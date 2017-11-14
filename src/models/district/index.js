const { DataTypes } = require('sequelize');
const sequelize     = require('../sequelize');
const routes        = require('./routes');

const District = sequelize.define('District', {
  id: {
    primaryKey: true,
    type:                   DataTypes.STRING,
  },
  label:                    DataTypes.STRING,
  descriptionEn:            DataTypes.TEXT,
  descriptionFr:            DataTypes.TEXT,
  descriptionEs:            DataTypes.TEXT,
});

District.associate = (models) => {
  District.hasMany(models.Apartment, {
    constraints: false,
  });
  District.hasMany(models.Term, {
    foreignKey: 'TermableId',
    constraints: false,
    scope: { termable: 'District' },
  });
};

District.routes = routes;

module.exports = District;
