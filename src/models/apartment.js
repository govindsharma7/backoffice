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
    addressStreet:            DataTypes.STRING,
    addressZip:               DataTypes.STRING,
    addressCity:              DataTypes.ENUM('lyon', 'montpellier'),
    addressCountry:           DataTypes.ENUM('france'),
    latLng:                   DataTypes.STRING,
    floorArea:                DataTypes.FLOAT,
  });

  Apartment.associate = () => {
    const {models} = sequelize;

    Apartment.hasMany(models.Room);
  };

  return Apartment;
};
