const Promise        = require('bluebird');
// const D              = require('date-fns');
const fetch          = require('../../vendor/fetch');
const Ninja          = require('../../vendor/invoiceninja');
const {
  WORDPRESS_AJAX_URL,
  REST_API_SECRET,
  NODE_ENV,
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
    },
    status: {
      type:                     DataTypes.ENUM('draft', 'active', 'cancelled'),
      defaultValue: 'active',
    },
    // TODO: this getter creates a lot of regression
    // We can only use this and get rid of #getComputedProperties after we've
    // improved our test coverage
    // balance: {
    //   type:                     DataTypes.VIRTUAL(DataTypes.INTEGER),
    //   get() {
    //     return (
    //       this.get('totalPaid') - this.get('amount') - this.get('totalRefund')
    //     );
    //   },
    // },
  }, {
    paranoid: true,
    scopes: Object.assign({}, TRASH_SCOPES/*, UNTRASHED_SCOPE*/),
  });

  Order.associate = () => {
    Order.hasMany(models.OrderItem);
    Order.belongsTo(models.Client, {
      foreignKey: {
        field: 'ClientId',
        allowNull: false,
      },
    });
    Order.hasMany(models.Payment);
    Order.hasMany(models.Credit);
    Order.hasMany(models.Term, {
      foreignKey: 'TermableId',
      constraints: false,
      scope: { termable: 'Order' },
    });
    Order.hasMany(models.Metadata, {
      foreignKey: 'MetadatableId',
      constraints: false,
      scope: { metadatable: 'Order' },
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
        'id',
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

    Order.addScope('welcomeEmail', {
      attributes: ['id'],
      include: [{
        model: models.OrderItem,
        attributes: ['id', 'ProductId'],
        where: { $or: [
          { ProductId: 'rent' },
          { ProductId: { $like: '%-deposit' } }]},
        include: [{
          model: models.Renting,
          attributes: ['id', 'bookingDate', 'serviceFees', 'price'],
          include: [{
            model: models.Room,
            attributes: ['id', 'reference'],
            include: [{
              model: models.Apartment,
              attributes: ['name', 'addressStreet', 'addressZip', 'addressCity'],
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

  Order.prototype.destroyOrCancel = function() {
    if ( this.status === 'cancelled' || this.deletedAt ) {
      throw new Error('This order is already destroyed or cancelled');
    }

    // Some orders can be deleted straight away
    if (
      this.type !== 'debit' ||
      ( !this.receiptNumber && !this.Payments.length )
    ) {
      return Promise.all([this.destroy()]); // resolve w/ [order] for consistency
    }

    // Others must be 'cancelled'
    return sequelize.transaction((transaction) => {
      const cancelPromise = Order.create({
        type: 'credit',
        label: `Credit Order - #${this.receiptNumber}`,
        ClientId: this.ClientId,
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
      }, {
        include: [{ model: models.OrderItem }],
        transaction,
      });
      const updatePromise = this.update({ status: 'cancelled' }, { transaction });

      return Promise.all([updatePromise, cancelPromise]);
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

  // Order.findUnpaidRentOrders = function(now = new Date()) {
  //   return Order.scope('rentOrders')
  //     .findAll({
  //       where: { $and: [
  //           { status: 'active' },
  //           { $or: [
  //             { dueDate: now },
  //             { dueDate: D.addDays(now, 3) },
  //             { dueDate: D.addDays(now, 5) },
  //           ] },
  //       ] },
  //       include: [{ model: models.Client }],
  //     });
  // };

  Order.afterUpdate = (order) => {
    if ( NODE_ENV !== 'development' && order.ninjaId != null ) {
      return Utils.wrapHookPromise(order.ninjaUpdate());
    }

    return true;
  };

  Order.collection = collection;
  Order.routes = routes;
  Order.hooks = hooks;

  return Order;
};
