var Liana = require('forest-express-sequelize');

function collection({ Order }) {
  return {
    name: 'Invoice',
    idField: 'id',
    fields: [{
      field: 'id',
      type: 'String',
    }, {
      field: 'label',
      type: 'String',
    }, {
      field: 'invoiceNumber',
      type: 'String',
    }, {
      field: 'clientFullName',
      type: 'String',
      get(object) {
        console.log(object);
      }
    }, {
      field: 'amountTaxExcluded',
      type: 'Number',
    }, {
      field: 'VAT',
      type: 'Number',
    }, {
      field: 'amountTaxIncluded',
      type: 'Number',
    }, {
      field: 'dueDate',
      type: 'Date',
    }, {
      field: 'totalPaid',
      type: 'Number',
    }, {
      field: 'balance',
      type: 'Number',
    }, {
      field: 'paymentType',
      type: 'String',
    }, {
      field: 'paymentDate',
      type: 'Date',
    }, {
      field: 'city',
      type: 'String',
    }, {
      field: 'room',
      type: 'String',
    }],
    segments: [{
      name: 'hasInvoiceNumber',
      where: () =>
        Order
          .findAll({
            where: { receiptNumber: { $not: null } },
            attributes: ['id'],
          })
          .reduce((acc, curr) => {
            acc.id.push(curr.id);
            return acc;
          }, { id: [] }),
    }],
  };
}

function routes(app, { Order, Client, OrderItem, Renting, Room, Apartment }) {
  app.get('/forest/invoices', Liana.ensureAuthenticated, async (req, res) => {
    const orders = await Order.findAll({
      include: [{
        model: Client,
        attributes: ['firstName', 'lastName'],
      }, {
        model: OrderItem,
        include: [{
          model: Renting,
          required: false,
          attributes: [],
          include: [{
            model: Room,
            attributes: ['name'],
            include: [{
              model: Apartment,
              attributes: ['addressCity'],
            }],
          }],
        }],
      }],
    });

    return res.send(orders);
  });
}

module.exports = {
  collection,
  routes,
};
