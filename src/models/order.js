const Promise        = require('bluebird');
const Liana          = require('forest-express-sequelize');
const Ninja          = require('../vendor/invoiceninja');
const makePublic     = require('../middlewares/makePublic');
const Utils          = require('../utils');
const {TRASH_SCOPES} = require('../const');

const Serializer = Liana.ResourceSerializer;

module.exports = (sequelize, DataTypes) => {

  const {models} = sequelize;
  const Order = sequelize.define('Order', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    type: {
      type:                     DataTypes.ENUM('debit', 'credit', 'deposit'),
      required: true,
      defaultValue: 'debit',
      allowNull: false,
    },
    receiptNumber: {
      type:                     DataTypes.STRING,
      unique: true,
    },
    label: {
      type:                     DataTypes.STRING,
      required: true,
      allowNull: false,
    },
    ninjaId: {
      type:                     DataTypes.INTEGER,
    },
    dueDate: {
      type:                     DataTypes.DATEONLY,
      required: true,
      defaultValue: Date.now(),
      allowNull: false,
    },
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

  Order.associate = () => {
    Order.hasMany(models.OrderItem);
    Order.belongsTo(models.Client);
    Order.hasMany(models.Payment);
    Order.hasMany(models.Credit);
    Order.hasMany(models.Term, {
      foreignKey: 'TermableId',
      constraints: false,
      scope: { termable: 'Order' },
    });

    Order.addScope('totalPaidRefund', {
      attributes: [[
        sequelize.fn('sum', sequelize.literal('`Payments`.`amount`')),
        'totalPaid',
      ], [
        sequelize.fn('sum', sequelize.literal('`Payments->Refunds`.`amount`')),
        'totalRefund',
      ]],
      include: [{
        model: models.Payment,
        attributes: [],
        include: [{
          model: models.Credit,
          as: 'Refunds',
          attributes: [],
        }],
      }],
    });

    const [
      unitPrice,
      quantity,
      vatRate,
    ] = 'unitPrice,quantity,vatRate'.split(',').map((col) => {
      return `\`OrderItems\`.\`${col}\``;
    });

    Order.addScope('amount', {
      attributes: [
        [sequelize.fn('sum', sequelize.literal(
          `${unitPrice} * ${quantity} * ( 1 + IFNULL(${vatRate}, 0) )`
        )), 'amount'],
      ],
      include:[{
        model: models.OrderItem,
        attributes: [],
      }],
    });

    Order.addScope('forRenting', (id) => {
      return {
        include: [{
          attributes: { include: [
            [sequelize.fn('count', 'OrderItems.id'), 'matchingItemsCount'],
          ] },
          model: models.OrderItem,
          where: {
            RentingId: id,
            '$OrderItems.matchingItemsCount$': { $gte: 1 },
          },
        }],
      };
    });
  };

  Order.INVOICE_STATUS_DRAFT = 1;

  Order.prototype.getTotalPaidAndRefund = function() {
    const option = this.deletedAt != null ? {paranoid: false} : {paranoid: true};

    return Order.scope('totalPaidRefund')
      .findById(this.id, option)
      .then((order) => {
        return {
          totalPaid: order.get('totalPaid'),
          totalRefund: order.get('totalRefund'),
        };
      });
  };

  Order.prototype.getAmount = function() {
    const option = this.deletedAt != null ? {paranoid: false} : {paranoid: true};

    return Order.scope('amount')
      .findById(this.id, option)
      .then((order) => {
        return order.get('amount');
    });
  };
  // Return all calculated props (amount, totalPaid, balance)
  Order.prototype.getCalculatedProps = function() {
    return Promise.all([
        this.getTotalPaidAndRefund(),
        this.getAmount(),
      ])
      .then(([{totalPaid, totalRefund}, amount]) => {
        return {
          amount,
          totalPaid,
          totalRefund,
          balance: totalPaid - amount - totalRefund,
        };
      });
  };

  Order.prototype.pickReceiptNumber = function() {
    var settingId;
    var strNumber;

    switch (this.type) {
      case 'deposit':
        settingId = 'deposit-counter';
        strNumber = (num) => { return `deposit-${num}`; };
        break;
      case 'credit':
      case 'debit':
      default:
        settingId = 'invoice-counter';
        strNumber = (num) => { return num.toString(); };
        break;
    }

    return sequelize.transaction((transaction) => {
      return models.Setting
        .findById(settingId, { transaction })
        .then((counter) => {
          return Promise.all([
            counter.increment({transaction}),
            this.update(
              { receiptNumber: strNumber(counter.value + 1) },
              { transaction }
            ),
          ]);
        });
      })
      .then(() => {
        return this;
      });
  };

  Order.prototype.ninjaSerialize = function(props) {
    return Promise.all([
        this.getClient(),
        this.getCalculatedProps(),
        this.getOrderItems()
          .then((orderItems) => {
            return Promise.map(orderItems, (item) => {
              return item.ninjaSerialize();
            });
          }),
      ])
      .then(([client, {amount, balance}, items]) => {
        return Object.assign({
          'client_id': client.ninjaId,
          amount,
          balance,
          'invoice_items': items,
          'invoice_number': this.receiptNumber,
        }, props);
      });
  };

  Order.prototype.ninjaCreate = function() {
    return this
      .ninjaSerialize({
        'invoice_status_id': Order.INVOICE_STATUS_DRAFT,
      })
      .then((ninjaOrder) => {
        return Ninja.invoice.createInvoice({
          'invoice': ninjaOrder,
        });
      })
      .then((response) => {
        this
          .set('ninjaId', response.obj.data.id)
          .save({hooks: false});
        return response.obj.data;
      });
  };

  Order.prototype.ninjaUpdate = function() {
    return this
      .ninjaSerialize()
      .then((ninjaOrder) => {
        return Ninja.invoice.updateInvoice({
          'invoice_id': this.ninjaId,
          'invoice': ninjaOrder,
        });
      })
      .then((response) => {
        return response.obj.data;
      });
  };

  Order.prototype.ninjaUpsert = function() {
    if (this.ninjaId != null) {
      return this.ninjaUpdate();
    }

    return Ninja.invoice
      .listInvoices({
        'invoice_number': this.receiptNumber,
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

  Order.ninjaCreateInvoices = (orders) => {
    return Promise.all(
      orders
        .filter((order) => {
          return order.ninjaId == null && order.price !== 0;
        })
        .map((order) => {
          return ( order.receiptNumber ?
              Promise.resolve(order) :
              order.pickReceiptNumber()
            ).then(() => {
              return order.ninjaCreate();
            });
        })
    );
  };

  // This is an alternative to Order.findOrCreate, to use when the only thing
  // we're interested in is the existence of the orderItem
  Order.findItemOrCreate = function({where, defaults, include = [models.OrderItem] }) {
    return sequelize.transaction((transaction) => {
      return models.OrderItem
        .findAll({
          where,
          transaction,
        })
        .then((orderItems) => {
          return Promise.all( orderItems.length ?
            [Order.findById(orderItems[0].OrderId), false] :
            [Order.create(defaults, { include, transaction }), true]
          );
        });
    });
  };

  Order.afterUpdate = (order) => {
    if ( order.ninjaId != null ) {
      return Utils.wrapHookPromise(order.ninjaUpdate());
    }

    return true;
  };
  Order.hook('afterUpdate', Order.afterUpdate);

  Order.beforeLianaInit = (app) => {
    const LEA = Liana.ensureAuthenticated;

    // Make this route completely public
    app.get('/forest/Order/:orderId', makePublic);

    app.post('/forest/actions/generate-invoice', LEA, (req, res) => {
      Order
        .findAll({ where: { id: { $in: req.body.data.attributes.ids } } })
        .then((orders) => {
          return Order.ninjaCreateInvoices(orders);
        })
        .then(Utils.createSuccessHandler(res, 'Ninja invoices'))
        .catch(Utils.logAndSend(res));
    });

    app.get('/forest/Order/:orderId/relationships/Refunds', LEA, (req, res) => {
      models.Credit.scope('order')
        .findAll({ where: { '$Payment.OrderId$': req.params.orderId } })
        .then((credits) => {
          return new Serializer(Liana, models.Credit, credits, {}, {
            count: credits.length,
          }).perform();
        })
        .then((result) => {
          return res.send(result);
        })
        .catch(Utils.logAndSend(res));
    });

    Utils.addRestoreAndDestroyRoutes(app, Order);
  };

  return Order;
};
