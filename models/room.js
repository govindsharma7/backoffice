module.exports = (sequelize, DataTypes) => {
  const Room = sequelize.define('Room', {
    id: {
      type:                   DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    roomNumber:               DataTypes.STRING,
    floorArea:                DataTypes.FLOAT,
  }, {
    classMethods: {
      associate: function(models) {
        Room.belongsTo(models.Apartment);
        Room.belongsToMany(models.Client, {
          through: models.ClientRoom,
        });
      },
    },
  });

  return Room;
};
