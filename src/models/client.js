// const Serializer = require('forest-express').ResourceSerializer;
// const Liana      = require('forest-express-sequelize');
const Ninja      = require('../vendor/invoiceninja');

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
    invoiceninjaClientId:       DataTypes.INTEGER,
  });

  /*
   * Associations
   */
  Client.associate = () => {
    const {models} = sequelize;

    Client.hasMany(models.Renting);
    Client.hasMany(models.Order);
  };

  Client.prototype.toInvoiceninjaClient = function() {
    return Promise.resolve({
      'name': `${this.firstName} ${this.lastName}`,
      'contact': {
        'first_name': this.firstName,
        'last_name': this.lastName,
        'email': this.email,
      },
    });
  };

  Client.prototype.createInvoiceninja = function() {
    return this
      .toInvoiceninjaClient()
      .then((ninjaClient) => {
        return Ninja.client.createClient({
          'client': ninjaClient,
        });
      })
      .then((response) => {
        return this
          .set('invoiceninjaClientId', response.obj.data.id)
          .save({hooks: false});
      });
  };

  Client.prototype.updateInvoiceninja = function() {
    return Ninja.client
      .updateClient({
        'client_id': this.invoiceninjaClientId,
        'client': this.toInvoiceninjaClient(),
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
  //             'client_id': client.invoiceninjaClientId,
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
    if ( !client.invoiceninjaClientId ) {
      client.createInvoiceninja()
        .catch((error) => {
          console.error(error);
          throw error;
        });
    }

    return true;
  });

  Client.hook('afterUpdate', (client) => {
    if (
      client.invoiceninjaClientId && (
        client.changed('firstName') ||
        client.changed('lastName') ||
        client.changed('email')
      )
    ) {
      client.updateInvoiceninja()
        .catch((error) => {
          console.error(error);
          throw error;
        });
    }

    return true;
  });

  return Client;
};
