module.exports = (sequelize, DataTypes) => {
  const Metadata = sequelize.define('Metadata', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    name:                      DataTypes.STRING,
    value:                     DataTypes.TEXT,
    metadatable:               DataTypes.STRING,
    MetadatableId:             DataTypes.STRING,
  });
  const {models} = sequelize;

  Metadata.associate = () => {
    Metadata.belongsTo(models.Client, {
      foreignKey: 'MetadatableId',
      constraints: false,
      as: 'Client',
    });
  };

  return Metadata;
};
