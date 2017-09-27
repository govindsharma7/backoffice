const routes     = require('./routes');
const hooks      = require('./hooks');

module.exports = (sequelize, DataTypes) => {
  const {models} = sequelize;
  const Picture = sequelize.define('Picture', {
    id: {
      primaryKey: true,
      type:                 DataTypes.UUID,
      defaultValue:         DataTypes.UUIDV4,
    },
    url: {
      type:                 DataTypes.STRING,
      allowNull: false,
    },
    PicturableId: {
      type:                 DataTypes.STRING,
    },
    alt:                    DataTypes.STRING,
    picturable: {
      type:                 DataTypes.STRING,
      required: true,
      allowNull: false,
    },
    order:                  DataTypes.INTEGER,
  });

  Picture.associate = () => {
    Picture.belongsTo(models.Apartment, {
      foreignKey: 'PicturableId',
      constraints: false,
      as: 'Apartment',
    });
    Picture.belongsTo(models.Room, {
      foreignKey: 'PicturableId',
      constraints: false,
      as: 'Room',
    });
  };

  Picture.routes = routes;
  Picture.hooks = hooks;


  return Picture;
};
