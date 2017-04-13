const Promise   = require('bluebird');
const Ninja      = require('../vendor/invoiceninja');

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
    label: {
      type:                     DataTypes.STRING,
      required: true,
    },
    invoiceninjaInvoiceId: {
      type:                     DataTypes.INTEGER,
      unique: true,
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
      return Promise.reduce(orderItems, (sum, orderItem) => {
        return orderItem.getAmount().then((amount) => {
          return sum + amount;
        });
      }, 0);
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

  Order.prototype.toInvoiceninjaOrder = function(props) {
    return Promise.all([
        this.getClient(),
        this.getOrderItems(),
      ])
      .then(([client, orderItems]) => {
        return Promise.all([
          client,
          this.getAmount(orderItems),
          this.getTotalPaid(),
          Promise.map(orderItems, (item) => {
            return item.toInvoiceninjaItem();
          }),
        ]);
      })
      .then(([client, amount, totalPaid, items]) => {
        return Object.assign({
          'client_id': client.invoiceninjaClientId,
          'amount': amount,
          'balance': totalPaid - amount,
          'invoice_items': items,
        }, props);
      });
  };

  Order.prototype.createInvoiceninja = function(props) {
    return this
      .toInvoiceninjaOrder(Object.assign({
        'invoice_number': this.invoiceNumber,
        'invoice_status_id': Order.INVOICE_STATUS_DRAFT,
      }, props))
      .then((ninjaOrder) => {
        return Ninja.invoice.createInvoice({
          'invoice': ninjaOrder,
        });
      })
      .then((response) => {
        return this
          .set('invoiceninjaInvoiceId', response.obj.data.id)
          .save({hooks: false})
          // return response for consistency
          .then(() => { return response; });
      });
  };

  Order.prototype.updateInvoiceninja = function(props) {
    return this
      .toInvoiceninjaOrder(props)
      .then((ninjaOrder) => {
        return Ninja.invoice.updateInvoice({
          'invoice_id': this.invoiceninjaInvoiceId,
          'invoice': ninjaOrder,
        });
      });
  };

  // Order.hook('afterUpdate', (order) => {
  //   if (
  //     order.invoiceninjaInvoiceId &&
  //     order.invoiceninjaInvoiceId === Order.READY
  //   ) {
  //     return sequelize.transaction((t) => {
  //       var currCounter;
  //       return models.Setting.findById(`${order.type}-counter`)
  //         .then((setting) => {
  //           currCounter = parseInt(setting.value);
  //
  //           return Ninja.invoice.createInvoice({
  //
  //           })
  //         });
  //     })
  //
  //     return Ninja.client
  //       .updateClient({
  //         'client_id': client.invoiceninjaClientId,
  //         'client': {
  //           'name': `${client.firstName} ${client.lastName}`,
  //           'contact': {
  //             'first_name': client.firstName,
  //             'last_name': client.lastName,
  //             'email': client.email,
  //           },
  //         },
  //       })
  //       .catch((error) => {
  //         console.error(error);
  //         throw error;
  //       });
  //   }
  //
  //   return true;
  // });

  return Order;
};
