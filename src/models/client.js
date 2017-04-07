// const Serializer = require('forest-express').ResourceSerializer;
// const Liana      = require('forest-express-sequelize');
const Ninja      = require('../vendor/invoiceninja');

module.exports = (sequelize, DataTypes) => {
  /*
   * Model definition
   */
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
  Client.associate = (models) => {
    Client.hasMany(models.Renting);
    Client.hasMany(models.Order);
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
   * Those hooks are used to update InvoiceNinja records when clients are updated
   * in Forest.
   */
  Client.hook('afterCreate', (client) => {
    if ( !client.invoiceninjaClientId ) {
      return Ninja.client
        .createClient({
          client: {
            name: `${client.firstName} ${client.lastName}`,
            contact: {
              'first_name': client.firstName,
              'last_name': client.lastName,
              'email': client.email,
            },
          },
        })
        .then((response) => {
          client
            .set('invoiceninjaClientId', response.obj.data.id)
            .save({hooks: false});
        })
        .catch((error) => {
          console.error(error);
          throw error;
        });
    }

    return true;
  });

  Client.hook('afterUpdate', (client) => {
    if ( client.invoiceninjaClientId ) {
      if (
        client.changed('firstName') ||
        client.changed('lastName') ||
        client.changed('email')
      ) {
        return Ninja.client
          .updateClient({
            'client_id': client.invoiceninjaClientId,
            'client': {
              'name': `${client.firstName} ${client.lastName}`,
              'contact': {
                'first_name': client.firstName,
                'last_name': client.lastName,
                'email': client.email,
              },
            },
          })
          .catch((error) => {
            console.error(error);
            throw error;
          });
      }
    }

    return true;
  });

  return Client;
};
