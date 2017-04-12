module.exports = (sequelize, DataTypes) => {
  const Setting = sequelize.define('Setting', {
    id: {
      primaryKey: true,
      type:                     DataTypes.STRING,
      required:                 true,
    },
    value: {
      type:                     DataTypes.STRING,
      required: true,
    },
  });

  return Setting;
};
