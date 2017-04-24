const D           = require('date-fns');
const Ninja       = require('../vendor/invoiceninja');

module.exports = (sequelize, DataTypes) => {
  const Sequelize = sequelize.constructor;
  const Client = sequelize.define('Client', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    firstName: {
      type:                     DataTypes.STRING,
      required: true,
    },
    lastName: {
      type:                     DataTypes.STRING,
      required: true,
    },
    email: {
      type:                     DataTypes.STRING,
      required: true,
      unique: true,
    },
    secondaryEmail:             DataTypes.STRING,
    phoneNumber: {
      type:                     DataTypes.STRING,
      required: true,
    },
    preferredLanguage: {
      type:                     DataTypes.ENUM('fr','en'),
      defaultValue: 'en',
    },
    ninjaId:       DataTypes.INTEGER,
  });

  /*
   * Associations
   */
  Client.associate = () => {
    const {models} = sequelize;

    Client.hasMany(models.Renting);
    Client.hasMany(models.Order);
  };

  Client.prototype.getRentingOrder = function(date = Date.now()) {
    return this.getOrders({
        limit: 1,
        where: {
          type: 'invoice',
          dueDate: { $between: [D.startOfMonth(date), D.endOfMonth(date)] },
        },
        include: [{
          model: sequelize.models.OrderItem,
          where: { RentingId: { $not: null } },
        }],
      })
      .then(([order]) => {
        return order;
      });
  };

  Client.prototype.getRentingsForMonth = function(date = Date.now()) {
    return this.getRentings({
      where: {
        $and: {
          checkinDate: { $lte: D.endOfMonth(date) },
          checkoutDate: {
            $or: {
              $eq: null,
              $gte: D.startOfMonth(date),
            },
          },
        },
      },
    });
  };

  Client.prototype.createRentingOrder = function(date = Date.now()) {
    this.getRentingsForMonth(date)
      .then((records) => {
        console.log('YEAAAAAAAAAAAAAAAAAAAAAAAAAAAAH')
        console.log(records);
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

  /*
   * Extra routes
   */
  // Client.beforeLianaInit = (models, app) => {
  //   app.get('/forest/Client/:clientId/relationships/Invoice',
  //     Liana.ensureAuthenticated,
  //     (req, res, next) => {
  //       Client
  //         .findById(req.params.clientId)
  //         .then((client) => {
  //           return Ninja.invoice.listInvoices({
  //             'client_id': client.ninjaId,
  //           });
  //         })
  //         .then((response) => {
  //           return new Serializer(Liana, models.Invoice, response.obj.data, {}, {
  //             count: response.obj.data.length
  //           }).perform();
  //         })
  //         .then(res.send)
  //         .catch((error) => {
  //           console.error(error);
  //           next();
  //         });
  //     }
  //   );
  // };

  /*
   * CRUD hooks
   *
   * Those hooks are used to update Invoiceninja records when clients are updated
   * in Forest.
   */
  Client.hook('afterCreate', (client) => {
    if ( !client.ninjaId ) {
      client.ninjaCreate()
        .catch((error) => {
          console.error(error);
          throw error;
        });
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
      client.ninjaUpdate()
        .catch((error) => {
          console.error(error);
          throw error;
        });
    }

    return true;
  });

  return Client;
};
