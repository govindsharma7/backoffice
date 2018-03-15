const { DataTypes } = require('sequelize');
const Liana         = require('forest-express-sequelize');
const sequelize     = require('../sequelize');
const makePublic    = require('../../middlewares/makePublic');

const Metadata = sequelize.define('Metadata', {
  id: {
    primaryKey: true,
    type:                     DataTypes.UUID,
    defaultValue:             DataTypes.UUIDV4,
  },
  name:                       DataTypes.STRING,
  value:                      DataTypes.TEXT,
  metadatable: {
    type:                     DataTypes.STRING,
    required: true,
    allowNull: false,
  },
  MetadatableId: {
    type:                     DataTypes.STRING,
    required: true,
    allowNull: false,
  },
});

Metadata.associate = (models) => {
  Metadata.belongsTo(models.Client, {
    foreignKey: 'MetadatableId',
    constraints: false,
    as: 'Client',
  });
};

Metadata.createOrUpdate = function({name, value, metadatable, MetadatableId}) {
  return Metadata.findOrCreate({
    where: {
      name,
      MetadatableId,
    },
    defaults: {
      name,
      value,
      metadatable,
      MetadatableId,
    },
  })
  .then(([metadata, isCreated]) => {
    if ( !isCreated ) {
      return metadata.update({value});
    }
    return metadata;
  });
};

Metadata.routes = (app) => {
  const LEA = Liana.ensureAuthenticated;

  app.get('/forest/Metadata', (req, res, next) => (
      req.query.filterType === 'and' &&
      req.query.filter &&
      req.query.filter.name === 'clientIdentity' &&
      req.query.filter.metadatable === 'Client'
    ) ?
    makePublic(req, res, next) :
    LEA(req, res, next));
};

module.exports = Metadata;
