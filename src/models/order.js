const Promise    = require('bluebird');
const Ninja      = require('../vendor/invoiceninja');
const makePublic = require('../services/makePublic');

module.exports = (sequelize, DataTypes) => {

  const Order = sequelize.define('Order', {
    id: {
      primaryKey: true,
      type:                     DataTypes.UUID,
      defaultValue:             DataTypes.UUIDV4,
    },
    type: {
      type:                     DataTypes.ENUM('invoice', 'deposit', 'credit'),
      required: true,
      defaultValue: 'invoice',
    },
    number: {
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
  });

  Order.associate = () => {
    const {models} = sequelize;

    Order.hasMany(models.OrderItem);
    Order.belongsTo(models.Client);
    Order.hasMany(models.Payment);
  };

  Order.READY = -1;
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

  // Return all calculated props (amount, totalPaid, balance)
  Order.prototype.getCalculatedProps = function() {
    return Promise.all([
        this.getAmount(),
        this.getTotalPaid(),
      ])
      .then(([amount, totalPaid]) => {
        return {
          amount,
          totalPaid,
          balance: totalPaid - amount,
        };
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
          'invoice_number': this.number,
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
    if (this.ninjaId != null && this.ninjaId !== -1) {
      return this.ninjaUpdate();
    }

    return Ninja.invoice
      .listInvoices({
        'invoice_number': this.number,
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

  Order.afterUpdate = function(order) {
    if (
      order.ninjaId &&
      order.ninjaId !== Order.READY
    ) {
      return order.ninja.update();
    }

    return true;
  };
  Order.hook('afterUpdate', Order.afterUpdate);

  Order.hook('beforeCreate', (order) => {
    if ( order.number != null ) {
      return order;
    }

    return sequelize.models.Setting
      .findById(`${order.type}-counter`)
      .then((counter) => {
        return counter.increment();
      })
      .then((counter) => {
        return counter.reload();
      })
      .then((counter) => {
        switch (order.type) {
          case 'deposit':
            order.number = `deposit-${counter.value}`;
            break;
          case 'credit':
            order.number = `avoir-${counter.value}`;
            break;
          case 'invoice':
          default:
            order.number = counter.value;
            break;
        }

        return order;
      });
  });

  Order.beforeLianaInit = (models, app) => {
    // ake this route completely public
    app.get('/forest/Order/:orderId', makePublic);
  };

  return Order;
};
