const Promise = require('bluebird');

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

  Metadata.prototype.newHouseMateSerialized = function(houseMates) {
    const data = JSON.parse(this.value);
    const {day, month, year} = data.checkinDate;
    const common = {
      FIRSTNAME: data.fullName.first,
      CITY: houseMates[0].Rentings[0].Room.Apartment.addressCity,
      ARRIVAL: `${day}/${month}/${year}`,
      EMAIL: data.email,
    };
    const fr = {
      COUNTRY: data.nationalityFr,
      WORK:  data.isStudent ? 'étudier' : 'travailler',
    };
    const en = {
      COUNTRY: data.nationalityEn,
      WORK:  data.isStudent ? 'study' : 'work',
    };

    const emailFr = [];
    const emailEn = [];

    houseMates.filter((houseMate) => {
        return houseMate.preferredLanguage === 'fr';
    }).map((houseMate) => {
        return emailFr.push(houseMate.email);
    });

    houseMates.filter((houseMate) => {
        return houseMate.preferredLanguage === 'en';
    }).map((houseMate) => {
        return emailEn.push(houseMate.email);
    });

    return Promise.all([
      Object.assign({}, common, fr),
      Object.assign({}, common, en),
      emailFr,
      emailEn,
    ]);
  };

  return Metadata;
};
