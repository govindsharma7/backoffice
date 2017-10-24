const Promise        = require('bluebird');
const fetch          = require('../../vendor/fetch');
const Ninja          = require('../../vendor/invoiceninja');
const {
  WORDPRESS_AJAX_URL,
  REST_API_SECRET,
}                    = require('../../config');
const Utils          = require('../../utils');
const {
  TRASH_SCOPES,
  // UNTRASHED_SCOPE,
}                    = require('../../const');
const collection     = require('./collection');
const routes         = require('./routes');
const hooks          = require('./hooks');

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
      defaultValue: 'debit',
      // required: true,
      // allowNull: false,
    },
    receiptNumber: {
      type:                     DataTypes.STRING,
      unique: true,
    },
    label: {
      type:                     DataTypes.STRING,
      // required: true,
      // allowNull: false,
    },
    ninjaId: {
      type:                     DataTypes.INTEGER,
    },
    dueDate: {
      type:                     DataTypes.DATEONLY,
      defaultValue: new Date(),
      // required: true,
      // allowNull: false,
    },
    status: {
      type:                     DataTypes.ENUM('draft', 'active'),
      defaultValue: 'active',
      // required: true,
      // allowNull: false,
    },
  }, {
    paranoid: true,
    scopes: Object.assign({}, TRASH_SCOPES/*, UNTRASHED_SCOPE*/),
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

    Order.addScope('orderItems', {
      include: [{
        model: models.OrderItem,
      }],
    });

    Order.addScope('rentOrders', {
      include: [{
        model: models.OrderItem,
        where: { ProductId: 'rent' },
      }],
    });

    Order.addScope('packItems', {
      include: [{
        model: models.OrderItem,
        where: { ProductId: { $like: '%-pack' } },
        include: [{
          model: models.Renting,
          include: [{
            model: models.Room,
          }],
        }],
      }],
    });

    Order.addScope('draftRentOrders', {
      include: [{
        model: models.OrderItem,
        where: {
          ProductId: 'rent',
          status: 'draft',
        },
        include: [{
          model: models.Renting,
        }],
      }],
//      paranoid: false,
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
      group: ['Order.id'],
    });

    Order.addScope('invoice', {
      include: [{
        model: models.Client,
        include: [{
          model: models.Metadata,
          required: false,
          where: { name: 'clientIdentity' },
        }],
      }, {
        model: models.OrderItem,
        include: [{
          model: models.Renting,
          required: false,
          include: [{
            model: models.Room,
            include: [{
              model: models.Apartment,
            }],
          }],
        }],
      }],
    });
  };

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

  Order.prototype.findOrCreateCancelOrder = function() {
    const order = {
      type: 'credit',
      // TODO: Searching existing order based on label is unreliable.
      // We should rahter have a status:cancelled of some kind
      // (and prevent cancelling an order that has already been cancelled)
      label: `Credit Order - #${this.receiptNumber}`,
      ClientId: this.ClientId,
    };

    return Order.findOrCreate({
      where: order,
      defaults: Object.assign({}, order, {
        OrderItems: this.OrderItems.map((orderItem) => {
          return {
            label: orderItem.label,
            quantity: orderItem.quantity,
            unitPrice: orderItem.unitPrice * -1,
            vatRate: orderItem.vatRate,
            ProductId: orderItem.ProductId,
            RentingId: orderItem.RentingId,
          };
        }),
      }),
      include: [{
        model: models.OrderItem,
      }],
    });
  };

  Order.prototype.pickReceiptNumber = function() {
    var settingId;
    var strNumber;

    if ( this.receiptNumber ) {
      return Promise.resolve(this);
    }

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
        this.getOrderItems(/*{paranoid: false}*/)
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
        'invoice_status_id': Ninja.INVOICE_STATUS_DRAFT,
      })
      .then((ninjaOrder) => {
        return Ninja.invoice.createInvoice({
          'invoice': ninjaOrder,
        });
      })
      .then((response) => {
        this.update({
          'ninjaId': response.obj.data.id,
        }, {
          hooks: false,
        });
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
    return Promise
      .filter(orders, (order) => {
        return order.ninjaId == null && order.amount !== 0;
      })
      .mapSeries((order) => {
        return order.pickReceiptNumber();
      })
      .mapSeries((order) => {
        return order.ninjaCreate();
      });
  };

  // This is an alternative to Order.findOrCreate, to use when the only thing
  // we're interested in is the existence of the orderItem
  Order.findItemOrCreate = function({where, defaults, include}) {
    return sequelize.transaction((transaction) => {
      return models.OrderItem
        .findAll({
          where,
          include,
          transaction,
        })
        .then((orderItems) => {
          return Promise.all( orderItems.length ?
            [Order.findById(orderItems[0].OrderId), false] :
            [Order.create(defaults, {
              include: [models.OrderItem],
              transaction,
            }), true]
          );
        });
    });
  };

  Order.prototype.markAsPaid = function() {
    return Order.markAsPaid(this);
  };
  Order.markAsPaid = function(order) {
    return Promise.all([
      // Switch order status from draft to active
      order.update({ status: 'active', deletedAt: null}),
      // Switch renting status from draft to active
      order.OrderItems && order.OrderItems[0] && models.Renting.update(
        { status: 'active', deletedAt: null },
        { where: { id: order.OrderItems[0].RentingId } }
      ),
      models.Client.update(
        { status: 'active', deletedAt: null },
        { where: { id: order.ClientId } }
      ),
      models.Order.update(
        { status: 'active', deletedAt: null },
        { where: { ClientId: order.ClientId } }
      ),
      // Mark renting as unavailable in WordPress
      order.OrderItems && order.OrderItems[0] && fetch(WORDPRESS_AJAX_URL, {
        method: 'post',
        body: {
          action: 'update_availability',
          privateKey: REST_API_SECRET,
          reference: order.OrderItems[0].Renting.Room.reference,
          meta: '20300901',
        },
      }),
    ]);
  };

  Order.afterUpdate = (order) => {
    // No need to prevent ninja update when NODE_ENV === 'test', as ninjaId == null
    if ( order.ninjaId != null ) {
      return Utils.wrapHookPromise(order.ninjaUpdate());
    }

    return true;
  };

  Order.collection = collection;
  Order.routes = routes;
  Order.hooks = hooks;

  return Order;
};
