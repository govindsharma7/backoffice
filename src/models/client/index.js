const Promise    = require('bluebird');
const D          = require('date-fns');
const find       = require('lodash/find');
const Payline    = require('payline');
const Ninja       = require('../../vendor/invoiceninja');
const webMerge   = require('../../vendor/webmerge');
const payline    = require('../../vendor/payline');
const Utils      = require('../../utils');
const {
  TRASH_SCOPES,
  LATE_FEES,
  DEPOSIT_PRICES,
  UNCASHED_DEPOSIT_FEE,
}                = require('../../const');
const {
  NODE_ENV,
  WEBMERGE_DOCUMENT_ID,
  WEBMERGE_DOCUMENT_KEY,
}                = require('../../config');
const routes     = require('./routes');

const _ = { find };

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
      validate: {
        is: /^([+]\d{11}|0{2}\d{11})$/,
      },
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
    Client.addScope('ordersFor', (date = Date.now()) => {
      return {
        where: {
          '$Order.type$': 'debit',
          '$Order.dueDate$': { $gte: D.startOfMonth(date), $lte: D.endOfMonth(date) },
        },
      };
    });
    Client.addScope('rentOrdersFor', (date = Date.now()) => {
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
    Client.addScope('currentApartment', function(date = Date.now()) {
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
          }],
        }],
      };
    });
    Client.addScope('metadata', {
      include: [{
        model: models.Metadata,
      }],
    });
  };

  // This was the reliable method used by generateInvoice
  // TODO: get rid of it once we're certain that script still works
  // Client.prototype.getRentingOrdersFor = function(date = Date.now()) {
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
  Client.prototype.getRentingsFor = function(date = Date.now()) {
    const startOfMonth = D.format(D.startOfMonth(date));

    return models.Renting.scope('room+apartment', 'checkoutDate').findAll({
      where: {
        ClientId: this.id,
        bookingDate: { $lte: D.endOfMonth(date) },
        $and: sequelize.literal(
          `(Events.id IS NULL OR Events.startDate >= '${startOfMonth}')`
        ),
      },
    });
  };

  Client.prototype.findOrCreateRentOrder =
    function(rentings, date = Date.now(), number) {
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
                return all.concat(renting.toOrderItems(date));
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

  Client.createRentOrders = function(clients, date = Date.now()) {
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

  Client.prototype.createMetadata = function(values) {
    const {address, birthDate} = values;
    const metadata = [{
      name: 'fullAddress',
      value: Utils.stripIndent(`\
        ${address[0]}${(address[1] || '') && ` ${address[1]}`}, \
        ${address[2]}, ${address[4]}, ${address[5]}`
      ),
    }, {
      name: 'birthDate',
      value: `${birthDate[0]}/${birthDate[1]}/${birthDate[2]}`,
    }, {
      name: 'birthPlace',
      value: `${values.birthPlace}`,
    }, {
      name: 'nationality',
      value: `${values.nationality}`,
    }].map((data) => {
      return Object.assign(data, {
        metadatable: 'Client',
        MetadatableId: this.id,
      });
    });

    return models.Metadata
      .bulkCreate(metadata);
  };

  // TODO: This belongs in renting
  Client.prototype.generateLease = function () {
    const {Metadata, Rentings} = this;
    const {Apartment} = Rentings[0].Room;
    const {addressStreet, addressZip, addressCity} = Apartment;
    const bookingDate = Rentings[0].bookingDate ?
      Rentings[0].bookingDate : D.format(Date.now());

    return webMerge.mergeDocument(WEBMERGE_DOCUMENT_ID, WEBMERGE_DOCUMENT_KEY, {
      fullName: `${this.firstName} ${this.lastName}`,
      fullAddress: _.find(Metadata, {name: 'fullAddress'}).value,
      birthDate: _.find(Metadata, {name: 'birthDate'}).value,
      birthPlace: _.find(Metadata, {name: 'birthPlace'}).value,
      nationality: _.find(Metadata, {name: 'nationality'}).value,
      floorArea: Apartment.floorArea,
      address: `${addressStreet}, ${addressZip}, ${addressCity}`,
      floor: Apartment.floor === 0 ? 'rez-de-chausée' : Apartment.floor,
      code: Apartment.code ? Apartment.code : 'néant',
      rent: Rentings[0].price / 100,
      serviceFees: Rentings[0].serviceFees / 100,
      bookingDate,
      endDate: D.addYears(D.subDays(bookingDate, 1), 1),
      deposit: DEPOSIT_PRICES[Apartment.addressCity] / 100,
      packLevel: this.Rentings[0].get('comfortLevel'),
      roomFloorArea: Rentings[0].Room.floorArea,
      apartmentRoomNumber: Apartment.Rooms.length,
      roomNumber: Rentings[0].Room.reference.slice(-1),
      email: this.email,
    // the last param turns on the test environment of webmerge
    }, NODE_ENV !== 'production');
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

  Client.prototype.calculateTodaysLateFees = function() {
    const {Orders} = this;
    var lateFees;

    return Promise.filter(Orders, (order) => {
      /*eslint-disable promise/no-nesting */
      return order.getCalculatedProps()
        .then(({balance}) => {
          return balance < 0;
        });
      /*eslint-enable promise/no-nesting */
      })
      .then((unpaidOrders) => {
        if ( unpaidOrders.length > 0 ) {
          lateFees = unpaidOrders.length * LATE_FEES;

          return lateFees;
        }

        return 0;
      });
  };

  Client.prototype.findOrCreateCurrentOrder = function (item) {
    const {Order, OrderItem} = models;

     return Order
        .findOrCreate({
          where: {
            ClientId: this.id,
            status: 'draft',
            deletedAt: {$ne: null},
          },
          paranoid: false,
          defaults: {
            ClientId: this.id,
            status: 'draft',
            label: 'Late fees',
            OrderItems: item,
            deletedAt: D.format(Date.now()),
          },
          include: [OrderItem],
        });
  };

  Client.prototype.applyLateFees = function() {

    return this.calculateTodaysLateFees()
      .then((lateFees) => {
        if ( lateFees === 0 ) {
          throw new Error('No late fees');
        }

        return Promise.all([
          this.findOrCreateCurrentOrder([{
            label: 'Late fees',
            unitPrice: lateFees,
            ProductId: 'late-fees',
          }]),
          lateFees,
        ]);
      })
      .then(([[order, isCreated], lateFees]) => {
        const orderItem = order.OrderItems
          .find((item) => {
            return item.ProductId === 'late-fees';
          });

        /*
          Check if an order item already exists and hasn't been updated today
          to avoid incrementing its unitprice twice or more per day
        */
        if ( isCreated || orderItem.updatedAt >= D.startOfDay(Date.now()) ) {
          return order;
        }
        /*eslint-disable promise/no-nesting */
        return orderItem.increment('unitPrice', {by: lateFees})
          .then(() => {
            return order;
          });
        /*eslint-enable promise/no-nesting */
      })
      .catch((error) => {
        if (error.message === 'No late fees') {
          return true;
        }

        return error;
      });
  };

  /*
   * CRUD hooks
   *
   * Those hooks are used to update Invoiceninja records when clients are updated
   * in Forest.
   */
  Client.hook('afterCreate', (client) => {
    if ( !client.ninjaId ) {
      return Utils.wrapHookPromise(client.ninjaCreate());
    }

    return true;
  });

  Client.hook('afterUpdate', (client) => {
    if (
      client.ninjaId && (
        client.changed('firstName') ||
        client.changed('lastName') ||
        client.changed('email')
      )
    ) {
      return Utils.wrapHookPromise(client.ninjaUpdate());
    }

    return true;
  });

  Client.beforeLianaInit = routes;

  return Client;
};
