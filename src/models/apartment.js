const Promise        = require('bluebird');
const bodyParser     = require('body-parser');
const Liana          = require('forest-express');
const D              = require('date-fns');
const Geocode        = require('../vendor/geocode');
const sns            = require('../vendor/aws');
const config         = require('../config');
const Utils          = require('../utils');
const {TRASH_SCOPES} = require('../const');

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

    Apartment.addScope('currentClient', function(date = D.format(Date.now())) {
      return {
        include: [{
          model: models.Room,
          include: [{
            model: models.Renting,
            where: sequelize.literal(`(\`Rooms->Rentings->Events\`.id IS NULL OR
\`Rooms->Rentings->Events\`.startDate >= '${date}')`),
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

  Apartment.prototype.getCurrentClientsPhoneNumber = function() {
    const phoneNumbers = [];

    this.Rooms.forEach((room) => {
      const {Client} = room.Rentings[0];

      if (Client.phoneNumber != null) {
        phoneNumbers.push(Client.phoneNumber);
      }
    });
    return phoneNumbers;
  };

  Apartment.prototype.sendSms = (phoneNumbers, text) => {
    const date = D.format(Date.now(), 'YYYY-MM-DD');
    const time = D.format(Date.now(), 'HH-mm-ss');
    const topicName = {
      Name: `DATE_${date}_TIME_${time}`, /* required */
    };
    const createTopic = sns.createTopic(topicName).promise();
    let topic;

    return createTopic
      .then((data) => {
        topic = data.TopicArn;

        return Promise.filter(phoneNumbers, (number) => {
          let params = {
            phoneNumber: number, /* required */
          };
          var checkIfPhoneNumberIsOptedOut =
              sns.checkIfPhoneNumberIsOptedOut(params).promise();

          /* eslint-disable promise/no-nesting */
          return checkIfPhoneNumberIsOptedOut.then((phoneNumber) => {
            return !phoneNumber.isOptedOut;
          })
          /* eslint-enable promise/no-nesting */
          .catch((err) => {
            console.log(err, err.stack);
            return false;
          });
        });
      })
      .then((validNumbers) => {
        return Promise.map(validNumbers, (number) => {
          var params = {
            Protocol: 'sms',
            /* required */
            TopicArn: topic,
            /* required */
            Endpoint: number,
          };
          var subscribe = sns.subscribe(params).promise();

          /* eslint-disable promise/no-nesting */
          return subscribe.then(() => {
            return true;
          });
          /* eslint-enable promise/no-nesting */
        });
      })
      .then(() => {
        var params = {
          Message: text,
          /* required */
          MessageAttributes: {
          //MonthlySpendLimit: {
          //  DataType: 'Number',
          //  StringValue: '30'
          //},
            DefaultSenderID: {
              DataType: 'String',
              /* required */
              StringValue: 'ChezNestor',
            },
            DefaultSMSType: {
              DataType: 'String',
              StringValue: 'Transactional',
            },
            DeliveryStatusIAMRole: {
              DataType: 'String',
              StringValue: config.AWS_SNS_Delivery_Status_IAM_Role,
            },
          },
          TopicArn: topic,
        };

        return sns.publish(params).promise();
      })
      .then(() => {
        return true;
      });
  };

  Apartment.beforeLianaInit = (app) => {
    const LEA = Liana.ensureAuthenticated;
    var urlencodedParser = bodyParser.urlencoded({ extended: true });

    app.post('/forest/actions/send-sms', urlencodedParser, LEA, (req, res) => {
      const {values, ids} = req.body.data.attributes;

      Promise.resolve()
      .then(() => {
        if (!ids || ids.length > 1 ) {
          throw new Error('You have to select one apartment');
        }
        return Apartment.scope('currentClient').findById(ids[0]);
      })
      .then((apartment) => {
          return Promise.all([apartment.getCurrentClientsPhoneNumber(), apartment]);
      })
      .then(([phoneNumbers, apartment]) => {
        return apartment.sendSms(phoneNumbers, values.bodySms);
      })
      .then(() => {
        return res.status(200).send({success: 'SMS successfully sended !'});
      })
      .catch(Utils.logAndSend(res));
    });
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

  return Apartment;
};
