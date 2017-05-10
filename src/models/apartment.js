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
    status: {
      type:                   DataTypes.ENUM('draft', 'active'),
      required: true,
      defaultValue: 'active',
    },
  }, {
    paranoid: true,
    scopes: {
      trashed: {
        attributes: ['id'],
        where: {
          deletedAt: { $not: null },
          status: { $ne: 'draft'},
        },
        paranoid: false,
      },
      draft: {
        attributes: ['id'],
        where: {
          deletedAt: { $not: null },
          status: 'draft',
        },
        paranoid: false,
      },
    },
  });
  const {models} = sequelize;

  Apartment.associate = () => {
    Apartment.hasMany(models.Room);
  };

  return Apartment;
};
