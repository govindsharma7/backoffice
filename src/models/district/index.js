module.exports = (sequelize, DataTypes) => {
  const District = sequelize.define('District', {
    id: {
      primaryKey: true,
      type:                   DataTypes.STRING,
    },
    label:                    DataTypes.STRING,
    descriptionEn:            DataTypes.TEXT,
    descriptionFr:            DataTypes.TEXT,
    descriptionEs:            DataTypes.TEXT,
  });
  const {models} = sequelize;

  District.associate = () => {
    District.hasMany(models.Apartment, {
      constraints: false,
    });
    District.hasMany(models.Term, {
      foreignKey: 'TermableId',
      constraints: false,
      scope: { termable: 'District' },
    });
  };


  return District;
};
