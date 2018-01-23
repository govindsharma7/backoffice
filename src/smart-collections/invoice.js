// var Liana = require('forest-express-sequelize');

function collection() {
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
      field: 'apartment',
      type: 'String',
    }, {
      field: 'room',
      type: 'String',
    }],
  };
}

// function routes(app, { Order }) {
//   app.get('/forest/invoices', Liana.ensureAuthenticated, (req, res) => {
//     Order.scope().findAll
//   });
// }

module.exports = {
  collection,
  // routes,
};
