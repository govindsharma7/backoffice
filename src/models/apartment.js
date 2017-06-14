const Promise                     = require('bluebird');
const bodyParser                  = require('body-parser');
const Liana                       = require('forest-express-sequelize');
const D                           = require('date-fns');
const Geocode                     = require('../vendor/geocode');
const Aws                         = require('../vendor/aws');
const Utils                       = require('../utils');
const {TRASH_SCOPES}              = require('../const');

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
        include: [{
          model: models.Room,
          attributes: [],
        }],
      }],
      group: ['Apartment.id'],
    });

    Apartment.addScope('currentClients', function(date = D.format(Date.now())) {
      return {
        include: [{
          model: models.Room,
          include: [{
            model: models.Renting,
            where: {
              $or: [{
                '$Rooms->Rentings->Events.id$': null,
              }, {
                '$Rooms->Rentings->Events.startDate$': {
                  $gte: date,
                },
              }],
            },
            include: [{
              model: models.Client,
            }, {
              model: models.Event,
              required: false,
              include: [{
                model: models.Term,
                where: {
                  taxonomy: 'event-category',
                  name: 'checkout',
                },
              }],
            }],
          }],
        }],
      };
    });
  };

  Apartment.prototype.getCurrentClientsPhoneNumbers = function() {
    return this.Rooms
      .map((room) => {
        return room.Rentings[0].Client.phoneNumber;
      })
      .filter(Boolean); // remove empty/falsy values
  };

  Apartment.hook('beforeValidate', (apartment) => {
    if ( apartment.latLng != null ) {
      return apartment;
    }

    return Geocode([
        apartment.addressStreet,
        apartment.addressZip,
        apartment.addressCountry,
      ].join(','))
      .then((res) => {
        return res.json();
      })
      .then((json) => {
        const {lat, lng} = json.results[0].geometry.location;

        apartment.set('latLng', `${lat},${lng}`);
        return apartment;
      });
  });

  Apartment.beforeLianaInit = (app) => {
    const LEA = Liana.ensureAuthenticated;
    const Serializer = Liana.ResourceSerializer;
    let urlencodedParser = bodyParser.urlencoded({ extended: true });

    app.post('/forest/actions/send-sms', urlencodedParser, LEA, (req, res) => {
      const {values, ids} = req.body.data.attributes;

      Promise.resolve()
        .then(() => {
          if (!ids || ids.length > 1 ) {
            throw new Error('You have to select one apartment');
          }
          return Apartment.scope('currentClients').findById(ids[0]);
        })
        .then((apartment) => {
          return apartment.getCurrentClientsPhoneNumbers();
        })
        .then((phoneNumbers) => {
          return Aws.sendSms(phoneNumbers, values.bodySms);
        })
        .then(() => {
          return res.status(200).send({success: 'SMS successfully sent!'});
        })
        .catch(Utils.logAndSend(res));
    });

    app.get(
      '/forest/Apartment/:recordId/relationships/currentClients',
      LEA,
      (req, res) => {
        models.Client.scope('apartmentCurrentClients')
          .findAll({ where: { '$Rentings->Room.ApartmentId$': req.params.recordId} })
          .then((client) => {
            return new Serializer(Liana, models.Client, client, {}, {
              count: client.length,
            }).perform();
          })
          .then((result) => {
            return res.send(result);
          })
          .catch(Utils.logAndSend(res));
      });
  };

  return Apartment;
};
