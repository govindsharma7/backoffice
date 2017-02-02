module.exports = (sequelize, DataTypes) => {
  const ClientRoom = sequelize.define('ClientRoom', {
    'id': {
      type:                     DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    checkinDate: {
      type:                     DataTypes.DATE,
      required: true,
    },
    checkoutDate:  {
      type:                     DataTypes.DATE,
      required: false,
    },
  }, {
    classMethods: {
    },
  });

  return ClientRoom;
};
