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
      type:                   DataTypes.ENUM('draft', 'active', 'archived'),
      required: true,
      defaultValue: 'active',
    },
  });
  const {models} = sequelize;

  Apartment.associate = () => {
    Apartment.hasMany(models.Room);
  };

  Apartment.beforeFind = (query) => {
    if (!('id' in query.where) && !('status' in query.where)) {
      if (query.where.$and) {
        const verif = query.where.$and.some((element) => {
          if (element.$and) {
            return element.$and.some((secondElement) => {
              return element.id ||
                element.status ||
                secondElement.id ||
                secondElement.status;
            });
          }
          return element.id || element.status;
        });

        if (!verif) {
          query.where.status = 'active';
        }
      }
      else {
        query.where.status = 'active';
      }
    }
  };

  Apartment.hook('beforeFind', Apartment.beforeFind);

  return Apartment;
};
