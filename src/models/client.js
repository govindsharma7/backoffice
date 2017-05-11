const Promise          = require('bluebird');
const D          = require('date-fns');
const Liana      = require('forest-express');
const Payline    = require('payline');
const uuid       = require('uuid/v4');
const Ninja      = require('../vendor/invoiceninja');
const config     = require('../config');
const payline    = require('../vendor/payline');
const {TRASH_SCOPES} = require('../const');

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
    ninjaId:                    DataTypes.INTEGER,
    status: {
      type:                     DataTypes.ENUM('draft', 'active'),
      required: true,
      defaultValue: 'active',
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
    Client.hasMany(models.Renting);
    Client.hasMany(models.Order);
  };

  Client.prototype.getRentingOrdersFor = function(date = Date.now()) {
    return this.getOrders({
        where: {
          type: 'debit',
          dueDate: { $gte: D.startOfMonth(date), $lte: D.endOfMonth(date) },
        },
        include: [{
          model: models.OrderItem,
          where: { RentingId: { $not: null } },
        }],
      });
  };

  Client.prototype.getRentingsFor = function(date = Date.now()) {
    return models.Renting.scope('room-apartment').findAll({
      where: {
        ClientId: this.id,
        bookingDate: { $lte: D.endOfMonth(date) },
        checkoutDate: {
          $or: {
            $eq: null,
            $gte: D.startOfMonth(date),
          },
        },
      },
    });
  };

  Client.prototype.createRentingsOrder = function(rentings, date = Date.now(), number) {
    const {Order, OrderItem} = models;
    const items = rentings.reduce((all, renting) => {
      return all.concat(renting.toOrderItems());
    }, []);

    return Order.create({
      type: 'debit',
      label: `${D.format('MMMM')} Invoice`,
      dueDate: D.startOfMonth(date),
      OrderItems: items,
      number,
    }, {
      include: [OrderItem],
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

 Client.doCredit = (clientId, values, idCredit) => {
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

  /*
   * CRUD hooks
   *
   * Those hooks are used to update Invoiceninja records when clients are updated
   * in Forest.
   */
  Client.hook('afterCreate', (client) => {
    if ( !client.ninjaId ) {
      client.ninjaCreate()
        .tapCatch(console.error);
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
        .tapCatch(console.error);
    }

    return true;
  });

  Client.beforeLianaInit = (app) => {
    const LEA = Liana.ensureAuthenticated;

    app.post('/forest/actions/credit-client', LEA, (req, res) => {
      const idCredit = uuid();
      const {values, ids} = req.body.data.attributes;

      if (
        !values.cardNumber || !values.cardType ||
        !values.expirationMonth || !values.expirationYear ||
        !values.cvv || !values.cardHolder || !values.amount
      ) {
        return res.status(400).send({error:'All fields are required'});
      }

      if (ids.length > 1) {
        return res.status(400).send({error:'Can\'t credit multiple clients'});
      }

      values.amount *= 100;

      return Client.doCredit(ids[0], values, idCredit)
        .then(() =>{
          return res.status(200).send({success: 'Credit ok'});
        })
        .catch((err) => {
          console.error(err);
          return res.status(400).send({error: err.longMessage});
        });
    });

    app.get('/forest/Client/:recordId/relationships/Invoices', LEA, (req, res) => {
      Client
        .findById(req.params.recordId)
        .then((client) => {
          return Ninja.invoice.listInvoices({
           'client_id': client.ninjaId,
          });
        })
        .then((response) => {
          const {data} = response.obj;

          return res.send({
            data: data.map((invoice) => {
              return {
                id: invoice.id,
                type: 'Invoice',
                attributes: {
                  href: `${config.INVOICENINJA_HOST}/invoices/${invoice.id}/edit`,
                },
              };
            }),
            meta: {count: data.length},
          });
        })
        .catch((err) => {
          console.error(err);
          return res.status(400).send({error: err.message});
        });
    });
  };

  return Client;
};
