const Promise          = require('bluebird');
const D          = require('date-fns');
const Liana      = require('forest-express');
const Payline    = require('payline');
const uuid       = require('uuid/v4');
const Ninja      = require('../vendor/invoiceninja');
const payline    = require('../vendor/payline');
const Utils      = require('../utils');
const {
  TRASH_SCOPES,
  INVOICENINJA_URL,
  LATE_FEES,
}                = require('../const');

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

    Client.addScope('roomCurrentClient', function(date = D.format(Date.now())) {
      return {
        include: [{
          model: models.Renting,
          where: sequelize.literal(`(\`Rentings->Events\`.id IS NULL OR
\`Rentings->Events\`.startDate >= '${date}')`),
          include: [{
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
      };
    });

    Client.addScope('apartmentCurrentClients', function(date = D.format(Date.now())) {
      return {
        include: [{
          model: models.Renting,
          where: sequelize.literal(`(\`Rentings->Events\`.id IS NULL OR
\`Rentings->Events\`.startDate >= '${date}')`),
          include: [{
            model: models.Event,
            required: false,
            include: [{
              model: models.Term,
              where: {
                taxonomy: 'event-category',
                name: 'checkout',
              },
            }],
          }, {
            model: models.Room,
          }],
        }],
      };
    });
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

  Client.prototype.createRentingsOrder = function(rentings, date = Date.now(), number) {
    const {Order, OrderItem} = models;
    const items = rentings.reduce((all, renting) => {
      return all.concat(renting.toOrderItems(date));
    }, []);

    return Order.create({
      type: 'debit',
      label: `${D.format(date, 'MMMM')} Invoice`,
      dueDate: D.startOfMonth(date),
      OrderItems: items,
      ClientId: this.id,
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
            label: 'test',
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
            quantity: 1,
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

  Client.beforeLianaInit = (app) => {
    const LEA = Liana.ensureAuthenticated;

    app.post('/forest/actions/credit-client', LEA, (req, res) => {
      const idCredit = uuid();
      const {values, ids} = req.body.data.attributes;

      Promise.resolve()
        .then(() => {
          if (
            !values.cardNumber || !values.cardType ||
            !values.expirationMonth || !values.expirationYear ||
            !values.cvv || !values.cardHolder || !values.amount
          ) {
            throw new Error('All fields are required');
          }

          if (ids.length > 1) {
            throw new Error('Can\'t credit multiple clients');
          }

          values.amount *= 100;

          return Client.paylineCredit(ids[0], values, idCredit);
        })
        .then(Utils.createSuccessHandler(res, 'Payline credit'))
        .catch(Utils.logAndSend(res));
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
                  href: `${INVOICENINJA_URL}/invoices/${invoice.id}/edit`,
                },
              };
            }),
            meta: {count: data.length},
          });
        })
        .catch(Utils.logAndSend(res));
    });
  };

  return Client;
};
