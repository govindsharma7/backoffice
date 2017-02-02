module.exports = (sequelize, DataTypes) => {
  const Client = sequelize.define('Client', {
    'id': {
      type:                     DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    'firstName':                DataTypes.STRING,
    'lastName':                 DataTypes.STRING,
    'email':                    DataTypes.STRING,
    'phoneNumber':              DataTypes.STRING,
  }, {
    classMethods: {
      associate: function(models) {
        Client.belongsToMany(models.Room, {
          through: models.ClientRoom,
        });
      },
    },
  });

  return Client;
};
