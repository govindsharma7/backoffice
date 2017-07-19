const Promise                     = require('bluebird');
const bodyParser                  = require('body-parser');
const D                           = require('date-fns');
const Liana                       = require('forest-express-sequelize');
const Geocode                     = require('../../vendor/geocode');
const Aws                         = require('../../vendor/aws');
const Utils                       = require('../../utils');
const {TRASH_SCOPES}              = require('../../const');
const collection                  = require('./collection');

module.exports = (sequelize, DataTypes) => {
  const Apartment = sequelize.define('Apartment', {
    id: {
      primaryKey: true,
      type:                   DataTypes.UUID,
      defaultValue:           DataTypes.UUIDV4,
    },
    reference: {
      type:                   DataTypes.STRING,
      unique: true,
    },
    name:                     DataTypes.STRING,
    addressStreet:            DataTypes.STRING,
    addressZip:               DataTypes.STRING,
    addressCity:              DataTypes.ENUM('lyon', 'montpellier', 'paris'),
    addressCountry:           DataTypes.ENUM('france'),
    code:                     DataTypes.STRING,
    floor:                    DataTypes.INTEGER,
    roomCount: {
      type:                   DataTypes.INTEGER,
      required: true,
      allowNull: false,
    },
    latLng:                   DataTypes.STRING,
    floorArea:                DataTypes.FLOAT,
    status: {
      type:                   DataTypes.ENUM('draft', 'active'),
      required: true,
      allowNull: false,
      defaultValue: 'active',
    },
    district:                 DataTypes.STRING,
  }, {
    paranoid: true,
    scopes: Object.assign({
      lyon: {
        where: {
          addressCity: 'lyon',
        },
      },
      paris: {
        where: {
          addressCity: 'paris',
        },
      },
      montpellier: {
        where: {
          addressCity: 'montpellier',
        },
      },
    }, TRASH_SCOPES),
  });
  const {models} = sequelize;

  Apartment.associate = () => {
    Apartment.hasMany(models.Room);

    Apartment.addScope('_roomCount', {
      attributes: { include: [
        [sequelize.fn('count', sequelize.col('Rooms.id')), '_roomCount'],
      ]},
      include: [{
        model: models.Room,
        attributes: [],
      }],
      group: ['Apartment.id'],
    });
  };

  Apartment.prototype.calculateLatLng = function(addressValues = this.dataValues) {
    return Geocode([
        addressValues.addressStreet,
        addressValues.addressZip,
        addressValues.addressCountry,
      ].join(','))
      .then(({lat, lng}) => {
        this.set('latLng', `${lat},${lng}`);
        return this;
      });
  };

  Apartment.hook('beforeCreate', (apartment) => {
    if ( apartment.latLng != null ) {
      return apartment;
    }

    return apartment.calculateLatLng();
  });

  Apartment.hook('beforeUpdate', (apartment) => {
    // if no address field has been updated…
    if (
      Object.keys(apartment.changed).every((name) => {
        return !/^address/.test(name);
      })
    ) {
      return apartment;
    }

    // We need to reload the existing apartment to make sure we have all address fields
    return Apartment
      .findById(apartment.id)
      .then((previousApartment) => {
        return apartment.calculateLatLng(Object.assign(
          {},
          previousApartment.dataValues,
          apartment.dataValues
        ));
      });
  });

  Apartment.beforeLianaInit = (app) => {
    const LEA = Liana.ensureAuthenticated;
    let urlencodedParser = bodyParser.urlencoded({ extended: true });

    app.post('/forest/actions/send-sms', urlencodedParser, LEA, (req, res) => {
      const {values, ids} = req.body.data.attributes;

      Promise.resolve()
        .then(() => {
          if (!ids || ids.length > 1 ) {
            throw new Error('You have to select one apartment');
          }
          return models.Client.scope('currentApartment')
            .findAll({ where: { '$Rentings->Room.ApartmentId$': ids} });
        })
        .tap((clients) => {
          return Aws.sendSms(
            clients
              .map((client) => { return client.phoneNumber; })
              .filter(Boolean), // filter-out falsy values
            values.bodySms
          );
        })
        .then((clients) => {
          return res.status(200).send({
            success: `SMS successfully sent to ${clients.length} clients!`,
          });
        })
        .catch(Utils.logAndSend(res));
    });

    Utils.addInternalRelationshipRoute({
      app,
      sourceModel: Apartment,
      associatedModel: models.Client,
      routeName: 'current-clients',
      scope: 'currentApartment',
      where: (req) => {
        return {
          '$Rentings->Room.ApartmentId$': req.params.recordId,
          '$Rentings.bookingDate$': { $lte:  D.format(Date.now()) },
        };
      },
    });

    Utils.addRestoreAndDestroyRoutes(app, Apartment);
  };

  Apartment.collection = collection;

  return Apartment;
};
