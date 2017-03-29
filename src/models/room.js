module.exports = (sequelize, DataTypes) => {
  const Room = sequelize.define('Room', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    reference: {
      type:                     DataTypes.STRING,
      unique: true,
    },
    floorArea:                  DataTypes.FLOAT,
    basePrice:                  DataTypes.FLOAT,
  });

  Room.associate = (models) => {
    Room.belongsTo(models.Apartment);
    Room.hasMany(models.Renting);
  };

  return Room;
};
