const Promise    = require('bluebird');
const D          = require('date-fns');
const Liana      = require('forest-express-sequelize');
const Ninja      = require('../vendor/invoiceninja');
const makePublic = require('../middlewares/makePublic');
const Utils      = require('../utils');
const {
  TRASH_SCOPES,
  LATE_FEES,
      } = require('../const');

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
    const oic = (col) => {
      return `\`OrderItems\`.\`${col}\``;
    };

    Order.hasMany(models.OrderItem);
    Order.belongsTo(models.Client);
    Order.hasMany(models.Payment);
    Order.hasMany(models.Credit);
    Order.hasMany(models.Term, {
      foreignKey: 'TermableId',
      constraints: false,
      scope: { termable: 'Order' },
    });

    Order.addScope('amount', {
      attributes: [
        [sequelize.fn('sum', sequelize.literal(
          `${oic('unitPrice')} * ${oic('quantity')} * ( 1 + ${oic('vatRate')} )`
        )), 'amount'],
      ],
      include: [{
        model: models.OrderItem,
        attributes: [],
      }],
      group: ['Order.id'],
    });

    Order.addScope('totalPaid', {
      attributes: [
        [sequelize.fn('sum', sequelize.col('Payments.amount')), 'totalPaid'],
      ],
      include: [{
        model: models.Payment,
        attributes: [],
      }],
      group: ['Order.id'],
    });

    Order.addScope('totalRefund', {
      attributes: [
        [sequelize.fn('sum', sequelize.col('Payments->Refunds.amount')), 'totalRefund'],
      ],
      include: [{
        model: models.Payment,
        attributes: [],
        include: [{
          model: models.Credit,
          as: 'Refunds',
          attributes: [],
        }],
      }],
      group: ['Order.id'],
    });

    Order.addScope('refunds', {
      include: [{
        model: models.Payment,
        include: [{
          model: models.Credit,
          as: 'Refunds',
        }],
      }],
    });
  };

  Order.INVOICE_STATUS_DRAFT = 1;

  Order.prototype.getAmount = function() {
    return Order.scope('amount')
      .findById(this.id)
      .then((order) => {
        return order.get('amount');
      });
  };

  Order.prototype.getTotalPaid = function() {
    return Order.scope('totalPaid')
      .findById(this.id)
      .then((order) => {
        return order.get('totalPaid');
      });
  };

  Order.prototype.getTotalRefund = function() {
    return Order.scope('totalRefund')
      .findById(this.id)
      .then((order) => {
        return order.get('totalRefund');
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
      .then(([client, {totalPaid, amount}, items]) => {
        return Object.assign({
          'client_id': client.ninjaId,
          amount,
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

  // the date arg is only used in unitTests
  Order.prototype.calculateLateFees = function(date = Date.now()) {
    if ( this.dueDate < D.format(date) ) {
      let lateFees = D.differenceInDays(date, this.dueDate) * LATE_FEES;
      return lateFees;
    }

    return null;
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
        .then(Utils.createSuccessHandler(res, 'Ninja invocies'))
        .catch(Utils.logAndSend(res));
    });

    app.get('/forest/Order/:orderId/relationships/Refunds', LEA, (req, res) => {
      models.Credit.scope('order')
        .findAll({ where: { 'Payment.OrderId': req.params.orderId } })
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
  };

  return Order;
};
