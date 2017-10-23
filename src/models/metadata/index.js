const Liana       = require('forest-express-sequelize');
const makePublic  = require('../../middlewares/makePublic');

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

    app.get('/forest/Metadata', (req, res, next) => {
      console.log(req.query);
      return (
        req.query.filterType === 'and' &&
        req.query.filter &&
        req.query.filter.name === 'clientIdentity' &&
        req.query.filter.metadatable === 'Client'
      ) ?
        makePublic(req, res, next) :
        LEA(req, res, next);

    });
  };

  return Metadata;
};
