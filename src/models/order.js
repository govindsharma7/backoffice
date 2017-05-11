const Promise    = require('bluebird');
const Liana      = require('forest-express-sequelize');
const Ninja      = require('../vendor/invoiceninja');
const makePublic = require('../middlewares/makePublic');
const {TRASH_SCOPES} = require('../const');

const Serializer = Liana.ResourceSerializer;

module.exports = (sequelize, DataTypes) => {

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
    },
    receiptNumber: {
      type:                     DataTypes.STRING,
      unique: true,
    },
    label: {
      type:                     DataTypes.STRING,
      required: true,
    },
    ninjaId: {
      type:                     DataTypes.INTEGER,
    },
    dueDate: {
      type:                     DataTypes.DATEONLY,
      required: true,
      default: Date.now(),
    },
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

  Order.associate = () => {
    Order.hasMany(models.OrderItem);
    Order.belongsTo(models.Client);
    Order.hasMany(models.Payment);
    Order.hasMany(models.Credit);
  };

  Order.INVOICE_STATUS_DRAFT = 1;

  Order.prototype.getAmount = function(orderItems) {
    return (
      orderItems && Promise.resolve(orderItems) ||
      this.getOrderItems()
    ).then((orderItems) => {
      /* eslint-disable promise/no-nesting */
      return Promise.reduce(orderItems, (sum, orderItem) => {
        return orderItem.getAmount().then((amount) => {
          return sum + amount;
        });
      }, 0);
      /* eslint-enable promise/no-nesting */
    });
  };

  Order.prototype.getTotalPaid = function(payments) {
    return (
      payments && Promise.resolve(payments) ||
      this.getPayments()
    ).then((payments) => {
      return payments.reduce((sum, payment) => {
        return sum + payment.amount;
      }, 0);
    });
  };

  Order.prototype.getTotalRefund = function() {
    return models.Credit
      .findRefundsFromOrder(this.id)
      .then((refunds) => {
        return refunds.reduce((sum, refund) => {
          return sum + refund.amount;
        }, 0);
      });
  };

  // Return all calculated props (amount, totalPaid, balance)
  Order.prototype.getCalculatedProps = function() {
    return Promise.all([
        this.getAmount(),
        this.getTotalPaid(),
        this.getTotalRefund(),
      ])
      .then(([amount, totalPaid, totalRefund]) => {
        return {
          amount,
          totalPaid,
          balance: totalPaid - amount - totalRefund,
          totalRefund,
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
    // We don't #getCalculatedProps as we want to avoid getOrderItems to be
    // called twice
    return Promise.all([
        this.getClient(),
        this.getTotalPaid(),
        this.getOrderItems()
          .then((orderItems) => {
            return Promise.all([
              this.getAmount(orderItems),
              Promise.map(orderItems, (item) => {
                return item.ninjaSerialize();
              }),
            ]);
          }),
      ])
      .then(([client, totalPaid, [amount, items]]) => {
        return Object.assign({
          'client_id': client.ninjaId,
          'amount': amount,
          'balance': totalPaid - amount,
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

  Order.generateInvoices = (orders) => {
    return Promise.all(
      orders
        .filter((order) => {
          return order.ninjaId == null;
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

  Order.afterUpdate = (order) => {
    if ( order.ninjaId != null ) {
      return order.ninjaUpdate();
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
          return Order.generateInvoices(orders);
        })
        .then(() => {
          return res.send({success: 'Invoice successfully generated'});
        })
        .catch((err) => {
          console.error(err);
          return res.status(400).send({error: err.message});
        });
    });

    app.get('/forest/Order/:orderId/relationships/Refunds', LEA, (req, res) => {
      models.Credit.findRefundsFromOrder(req.params.orderId)
        .then((credits) => {
          return new Serializer(Liana, models.Credit, credits, {}, {
            count: credits.length,
          }).perform();
        })
        .then((result) => {
          return res.send(result);
        })
        .catch((err) => {
          console.error(err);
          return res.status(400).send({error: err.message});
        });
    });
  };

  return Order;
};
