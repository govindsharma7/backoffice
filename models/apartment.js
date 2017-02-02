module.exports = (sequelize, DataTypes) => {
  const Apartment = sequelize.define('Apartment', {
    id: {
      type:                   DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    reference: {
      type:                   DataTypes.STRING,
      unique: true,
    },
    addressStreet:            DataTypes.STRING,
    addressCity:              DataTypes.STRING,
    addressZip:               DataTypes.STRING,
    addressState:             DataTypes.STRING,
    addressCountry:           DataTypes.STRING,
  }, {
    classMethods: {
      associate: function(models) {
        Apartment.hasMany(models.Room);
      },
    },
  });

  return Apartment;
};
