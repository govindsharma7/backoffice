const Promise         = require('bluebird');
const mapKeys         = require('lodash/mapKeys');
const capitalize      = require('lodash/capitalize');
const D               = require('date-fns');
const Payline         = require('payline');
const Country         = require('countryjs');
const GoogleTranslate = require('google-translate');
const Ninja           = require('../../vendor/invoiceninja');
const payline         = require('../../vendor/payline');
const Utils           = require('../../utils');
const {
  TRASH_SCOPES,
  LATE_FEES,
  UNCASHED_DEPOSIT_FEE,
  DATETIME_FORMAT,
}                     = require('../../const');
const config          = require('../../config');
const collection      = require('./collection');
const routes          = require('./routes');
const hooks           = require('./hooks');

const _ = { mapKeys, capitalize };
const Translate = Promise.promisify(
  GoogleTranslate(config.GOOGLE_TRANSLATE_API_KEY).translate
);

module.exports = (sequelize, DataTypes) => {
  const Client = sequelize.define('Client', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    firstName: {
      type:                     DataTypes.STRING,
      required: true,
      allowNull: false,
    },
    lastName: {
      type:                     DataTypes.STRING,
      required: true,
      allowNull: false,
      set(val) {
        this.setDataValue(
          'lastName', val.split(' ').map(_.capitalize).join(' ')
        );
      },
    },
    email: {
      type:                     DataTypes.STRING,
      required: true,
      unique: true,
      allowNull: false,
    },
    secondaryEmail:             DataTypes.STRING,
    phoneNumber: {
      type:                     DataTypes.STRING,
      required: true,
      validate: { is: Utils.isValidPhoneNumber.rValidPhoneNumber },
    },
    preferredLanguage: {
      type:                     DataTypes.ENUM('fr', 'en'),
      defaultValue: 'en',
    },
    ninjaId:                    DataTypes.INTEGER,
    status: {
      type:                     DataTypes.ENUM('draft', 'active'),
      required: true,
      defaultValue: 'active',
      allowNull: false,
    },
  }, {
    paranoid: true,
    scopes: TRASH_SCOPES,
  });
  const {models} = sequelize;

  /*
   * Associations
   */
  Client.associate = () => {
    const {fn, col} = sequelize;

    Client.hasMany(models.Renting);
    Client.hasMany(models.Order);
    Client.hasMany(models.Metadata, {
      foreignKey: 'MetadatableId',
      constraints: false,
      scope: { metadatable: 'Client' },
    });

    Client.addScope('rentOrders', {
      include: [{
        model : models.Order,
        include: [{
          model: models.OrderItem,
          where: { ProductId: 'rent' },
        }],
      }],
    });
    // TODO: one of the following two scopes is useless. Get rid of it
    Client.addScope('ordersFor', (date = new Date()) => {
      return {
        where: {
          '$Order.type$': 'debit',
          '$Order.dueDate$': { $gte: D.startOfMonth(date), $lte: D.endOfMonth(date) },
        },
      };
    });
    Client.addScope('rentOrdersFor', (date = new Date()) => {
      return {
        include: [{
          model : models.Order,
          required: false,
          where: {
            type: 'debit',
            dueDate: { $gte: D.startOfMonth(date), $lte: D.endOfMonth(date) },
          },
          include: [{
            model: models.OrderItem,
            where: { ProductId: 'rent' },
          }],
        }],
      };
    });
    Client.addScope('roomSwitchCount', {
      attributes: { include: [
        [fn('count', col('Orders.id')), 'roomSwitchCount'],
      ]},
      include: [{
        model: models.Order,
        attributes: ['id'],
        include: [{
          model: models.OrderItem,
          where: { ProductId: 'room-switch' },
          attributes: [],
        }],
      }],
      group: ['Client.id'],
    });
    Client.addScope('uncashedDepositCount', {
      attributes: { include: [
        [fn('count', col('Rentings.id')), 'uncashedDepositCount'],
      ]},
      include: [{
        model: models.Renting,
        include: [{
          model: models.Term,
          where: {
            taxonomy: 'deposit-option',
            name: 'do-not-cash',
          },
        }],
      }],
      group: ['Client.id'],
    });

    Client.addScope('currentApartment', function(date = new Date()) {
      return {
        where: { $or: [
            { '$Rentings.Events.id$': null },
            { '$Rentings.Events.startDate$': { $gte: D.format(date) } },
        ] },
        include: [{
          model: models.Renting,
          include: [{
            model: models.Event,
            attributes: ['id', 'startDate'],
            required: false,
            include: [{
              model: models.Term,
              attributes: [],
              where: {
                taxonomy: 'event-category',
                name: 'checkout',
              },
            }],
          }, {
            model: models.Room,
            attributes: ['id', 'ApartmentId'],
            include: [{
              model: models.Apartment,
              attributes: ['addressCity'],
            }],
          }],
        }],
      };
    });

    Client.addScope('latestClientRenting', {
      attributes: { include: [
        [fn('max', col('Rentings.bookingDate')), 'latestBookingDate'],
      ]},
      include: [{
        model: models.Renting,
        include: [{
          model: models.Room,
        }],
      }],
      group: ['Client.id'],
    });
  };

  // This was the reliable method used by generateInvoice
  // TODO: get rid of it once we're certain that script still works
  // Client.prototype.getRentingOrdersFor = function(date = new Date()) {
  //   return this.getOrders({
  //       where: {
  //         type: 'debit',
  //         dueDate: { $gte: D.startOfMonth(date), $lte: D.endOfMonth(date) },
  //       },
  //       include: [{
  //         model: models.OrderItem,
  //         where: {
  //           RentingId: { $not: null },
  //           ProductId: 'rent',
  //         },
  //       }],
  //     });
  // };

  // TODO: this can probably be improved to use a Client scope
  Client.prototype.getRentingsFor = function(date = new Date()) {
    const startOfMonth = D.format(D.startOfMonth(date), DATETIME_FORMAT);

    return models.Renting.scope('room+apartment', 'checkoutDate').findAll({
      where: {
        status: 'active',
        ClientId: this.id,
        bookingDate: { $lte: D.endOfMonth(date) },
        $and: sequelize.literal(
          // /!\ startOfMonth must be formatted using DATETIME_FORMAT
          `(Events.id IS NULL OR Events.startDate >= '${startOfMonth}')`
        ),
      },
    });
  };

  Client.prototype.findOrCreateRentOrder =
    function(rentings, date = new Date(), number) {
      return models.Order
        .findItemOrCreate({
          where: { ProductId: 'rent' },
          include: [{
            model: models.Order,
            where: {
              ClientId: this.id,
              dueDate: D.startOfMonth(date),
            },
          }],
          defaults: {
            label: `${D.format(date, 'MMMM')} Invoice`,
            type: 'debit',
            ClientId: this.id,
            dueDate: D.startOfMonth(date),
            OrderItems:
              rentings.reduce((all, renting) => {
                return all.concat(renting.toOrderItems({ date }));
              }, [])
              .concat(this.get('uncashedDepositCount') > 0 && {
                label: 'Option Liberté',
                unitPrice: UNCASHED_DEPOSIT_FEE,
                ProductId: 'uncashed-deposit',
              })
              .filter(Boolean),
            number,
          },
        });
  };

  Client.createRentOrders = function(clients, date = new Date()) {
    return Promise
      .mapSeries(clients, (client) => {
        return Promise.all([
          client,
          client.getRentingsFor(date),
        ]);
      })
      .filter(([, rentings]) => {
        return rentings.length !== 0;
      })
      .map(([client, rentings]) => {
        return client.findOrCreateRentOrder(rentings, date);
      });
  };

  Client.prototype.ninjaSerialize = function() {
    return Promise.resolve({
      'name': `${this.firstName} ${this.lastName}`,
      'contact': {
        'first_name': this.firstName,
        'last_name': this.lastName,
        'email': this.email,
      },
    });
  };

  Client.prototype.ninjaCreate = function() {
    return this
      .ninjaSerialize()
      .then((ninjaClient) => {
        return Ninja.client.createClient({
          'client': ninjaClient,
        });
      })
      .then((response) => {
        this
          .set('ninjaId', response.obj.data.id)
          .save({hooks: false});
        return response.obj.data;
      });
  };

  Client.prototype.ninjaUpdate = function() {
    return this
      .ninjaSerialize()
      .then((ninjaClient) => {
        return Ninja.client.updateClient({
          'client_id': this.ninjaId,
          'client': ninjaClient,
        });
      })
      .then((response) => {
        return response.obj.data;
      });
  };

  Client.prototype.ninjaUpsert = function() {
    if (this.ninjaId != null && this.ninjaId !== -1) {
      return this.ninjaUpdate();
    }

    return Ninja.client
      .listClients({
        'email': this.email,
        'per_page': 1,
      })
      .then((response) => {
        if ( response.obj.data.length ) {
          this
            .set('ninjaId', response.obj.data[0].id)
            .save({hooks: false});
          return this.ninjaUpdate();
        }

        return this.ninjaCreate();
      });
  };

  Client.paylineCredit = (clientId, values, idCredit) => {
    const {Order, OrderItem, Credit} = models;
    const card = {
      number: values.cardNumber,
      type: values.cardType,
      expirationDate: values.expirationMonth +
      values.expirationYear.slice(-2),
      cvx: values.cvv,
      holder: values.cardHolder,
    };

    return payline.doCredit(idCredit, card, values.amount, Payline.CURRENCIES.EUR)
      .then((result) => {
        return Order.create({
          id: idCredit,
          type: 'credit',
          label: values.orderLabel,
          ClientId: clientId,
          OrderItems: [{
            label: values.reason,
            unitPrice: values.amount * -1,
          }],
          Credits:[{
            amount: values.amount,
            reason: values.orderLabel,
            paylineId: result.transactionId,
          }],
        }, {
          include: [OrderItem, Credit],
        });
      });
  };

  Client.prototype.findUnpaidOrders = function () {
    const {Order} = models;

     return Order.scope('rentOrders')
        .findAll({
          where: {
            ClientId: this.id,
            dueDate: {$lt: new Date()},
          },
        })
        .filter((order) => {
          return order.getCalculatedProps()
            .then(({balance}) => {
              return balance < 0;
          });
      });
  };

  Client.prototype.applyLateFees = function(now = new Date()) {
    return this.findUnpaidOrders()
      .map((order) => {
        const lateFees = D.differenceInDays(now, order.dueDate);

        return order.getOrderItems({
          where: {ProductId: 'late-fees'},
        })
        .then((orderItem) => {
          return models.OrderItem
            .upsert({
              id: orderItem[0] && orderItem[0].id,
              OrderId: order.id,
              ProductId: 'late-fees',
              quantity: lateFees,
              unitPrice: LATE_FEES,
              label: 'Late fees',
            });
        })
        .thenReturn(order);
      });
  };

  // the last argument is only used for testing purpose
  Client.getIdentity = function(client, Metadata = models.Metadata, now = new Date()) {
    return Metadata.findOne({
        where: {
          MetadatableId: client.id,
          name: 'clientIdentity',
        },
      })
      .then((metadata) => {
        if ( metadata == null ) {
          return null;
        }

        const identity = JSON.parse(metadata.value.replace(/\r?\n|\r/g, ''));
        const {day, month, year} = identity.birthDate;

        identity.age =
          D.differenceInYears(now, `${year}-${month}-${day} Z`);

        return identity;
      });
  };

  Client.getIdentityRecordUrl = function(identity) {
    const passport =
      identity && identity.passport.match(/uploads\/cheznestor\/(.+?)\/(.+?)\//);

    return passport && `
      https://eu.jotform.com/server.php?action=getSubmissionPDF\
      &formID=${passport[1]}&sid=${passport[2]}
    `.replace(/\s+/g, '');
  };

  Client.getDescriptionEn = function(client) {
    return client && client.identity && Utils.toSingleLine(`
      ${client.firstName},
      ${client.identity.age} years old ${client.identity.nationalityEn}
      ${client.identity.isStudent ? 'student' : 'young worker'}
    `);
  };

  Client.getDescriptionFr = function(client) {
    return client && client.identity && Utils.toSingleLine(`
      ${client.firstName},
      ${client.identity.isStudent ? 'étudiant(e)' : 'jeune actif(ve)'}
      ${client.identity.nationalityFr} de ${client.identity.age} ans
    `);
  };

  Client.normalizeIdentityRecord = function(raw) {
    const values = _.mapKeys(raw, (value, key) => {
      return key.replace(/(q[\d]*_)/g, '');
    });
    const phoneNumber = values.phoneNumber.phone.replace(/^0/, '');

    values.phoneNumber = `${values.phoneNumber.area}${phoneNumber}`;
    values.countryEn = values.nationality;
    values.nationalityEn = Country.demonym(values.countryEn, 'name');
    values.countryFr = Country.translations(values.countryEn, 'name').fr;
    values.birthCountryEn = values.birthPlace.last;
    values.isStudent = /^(Student|Intern)$/.test(values.frenchStatus);

    return Promise.all([
      Translate(values.birthCountryEn, 'en', 'fr'),
      Translate(values.nationalityEn, 'en', 'fr'),
    ])
    .then(([{ translatedText : birthCountryFr }, { translatedText : nationalityFr }]) => {
      return Object.assign( values, { birthCountryFr, nationalityFr });
    });
  };

  Client.collection = collection;
  Client.routes = routes;
  Client.hooks = hooks;

  return Client;
};
