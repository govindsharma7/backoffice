const D          = require('date-fns');
const Liana      = require('forest-express');
const Payline    = require('payline');
const uuid       = require('uuid/v4');
const Ninja      = require('../vendor/invoiceninja');
const config     = require('../config');

const Serializer = Liana.ResourceSerializer;
const payline    = new Payline(
  config.PAYLINE_MERCHANT_ID,
  config.PAYLINE_ACCESS_KEY,
  config.PAYLINE_CONTRACT_NUMBER
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
      type:                     DataTypes.ENUM('fr', 'en'),
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

  Client.prototype.getRentingOrders = function(date = Date.now()) {
    return this.getOrders({
        where: {
          type: 'debit',
          dueDate: { $gte: D.startOfMonth(date), $lte: D.endOfMonth(date) },
        },
        include: [{
          model: sequelize.models.OrderItem,
          where: { RentingId: { $not: null } },
        }],
      });
  };

  Client.prototype.getRentingsForMonth = function(date = Date.now()) {
    const {models} = sequelize;

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
      include: [{
        model: models.Room,
        attributes: ['reference'],
        include: [{
          model: models.Apartment,
          attributes: ['reference'],
        }],
      }],
    });
  };

  Client.prototype.createRentingOrder = function(date = Date.now(), number) {
    const {Order, OrderItem} = sequelize.models;

    return this.getRentingsForMonth(date)
      .then((rentings) => {
        const items = [];

        rentings.forEach((renting) => {
          const prorated = renting.prorate(date);
          const room = renting.Room;
          const apartment = room.Apartment;
          const month = D.format(date, 'MMMM');

          items.push({
            label: `${month} Rent - Room #${room.reference}`,
            unitPrice: prorated.price,
            RentingId: renting.id,
          }, {
            label: `${month} Service Fees - Apt #${apartment.reference}`,
            unitPrice: prorated.serviceFees,
            ProductId: 'service-fees',
          });
        });

        return Order.create({
          type: 'debit',
          label: `${D.format('MMMM')} Invoice`,
          dueDate: D.startOfMonth(date),
          OrderItems: items,
          number,
        }, {
          include: [OrderItem],
        });
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

  Client.beforeLianaInit = (models, app) => {
<<<<<<< HEAD
    app.post('/forest/actions/credit-client', Liana.ensureAuthenticated, (req,res) =>{
      var id = uuid();
      var card = {
        number: req.body.data.attributes.values.cardNumber,
        type: req.body.data.attributes.values.cardType,
        expirationDate: req.body.data.attributes.values.expirationMonth +
        req.body.data.attributes.values.expirationYear.slice(-2),
        cvx: req.body.data.attributes.values.cvv,
        holder: req.body.data.attributes.values.cardHolder,
      };
      var amount = req.body.data.attributes.values.amount * 100;

      payline.doCredit(id, card, amount, Payline.CURRENCIES.EUR)
      .then((result) => {
        return models.Order
        .create({
          id,
          type: 'credit',
          label: req.body.data.attributes.values.orderLabel,
          ClientId: req.body.data.attributes.ids[0],
          OrderItems: [{
              label: req.body.data.attributes.values.reason,
              unitPrice: amount * -1,
              OrderId: id,
          }],
          Credits:[{
            amount,
            reason: req.body.data.attributes.values.orderLabel,
            paylineId: result.transactionId,
            OrderId: id,
          }],
        },{
          include: [models.OrderItem, models.Credit],
        });
      })
      .then(() =>{
       res.status(200).send({success: 'Refund ok'});
        return true;
      })
      .catch((err) => {
        console.error(err);
        res.status(400).send({error: err.longMessage});
      })
    });

    app.get('/forest/Client/:recordId/relationships/Invoices',
            Liana.ensureAuthenticated, (req, res) => {
      Client
        .findById(req.params.recordId)
        .then((client) => {
          return Ninja.invoice.listInvoices({
           'client_id': client.ninjaId,
          });
        })
        .then((response) => {
          var obj ={};

          obj.data = [];
          response.obj.data.forEach((invoice, index) => {
            obj.data[index] = {
              id: invoice.id,
              type: 'Invoice',
              attributes: {
                href: `${config.INVOICENINJA_HOST}/invoices/${invoice.id}/edit`,
              },
            };
          });
          obj.meta = {};
          obj.meta.count = response.obj.data.length;
          return res.send(obj);
        })
        .catch((error) => {
          console.error(error);
        });
=======
    app.get('/forest/Client/:recordId/relationships/Invoices', (req, res, next) => {
        Client
           .findById(req.params.recordId)
           .then((client) => {
             return Ninja.invoice.listInvoices({
               'client_id': client.ninjaId,
             });
           })
           .then((response) => {
            var obj ={};
            obj.data = [];
            response.obj.data.forEach((invoice, index) => {
              obj.data[index] = {
                id: invoice.id,
                type: 'Invoice',
                attributes: {
                  href: `${config.INVOICENINJA_HOST}/invoices/${invoice.id}/edit`,
                },
              }
            });
          obj.meta = {};
          obj.meta.count = response.obj.data.length;
          res.send(obj);
//             return new Serializer(Liana, models.Invoice, response.obj.data, {}, {
//               count: response.obj.data.length
//             }).perform();
           })
//           .then(res.send)
           .catch((error) => {
             console.error(error);
             next();
           });
>>>>>>> implement invoices relationships
    });
  };

  return Client;
};
