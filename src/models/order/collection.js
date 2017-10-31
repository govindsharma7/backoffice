const {
  TRASH_SEGMENTS,
  INVOICENINJA_URL,
}                     = require('../../const');
const { WEBSITE_URL } = require('../../config');
const Utils           = require('../../utils');

module.exports = function({Order}) {
  const memoizer = new Utils.calculatedPropsMemoizer(Order);

  return {
    fields: [{
      field: 'amount',
      type: 'Number',
      get(object) {
        return memoizer.getCalculatedProps(object)
          .then((result) => {
            return result.amount;
          });
      },
    }, {
      field: 'totalPaid',
      type: 'Number',
      get(object) {
        return memoizer.getCalculatedProps(object)
          .then((result) => {
            return result.totalPaid;
          });
      },
    }, {
      field: 'balance',
      type: 'Number',
      get(object) {
        return memoizer.getCalculatedProps(object)
          .then((result) => {
            return result.balance;
          });
      },
    }, {
      field: 'totalRefund',
      type: 'Number',
      get(object) {
        return memoizer.getCalculatedProps(object)
          .then((result) => {
            return result.totalRefund;
        });
      },
    }, {
      field: 'payment',
      type: 'String',
      get({ id, receiptNumber }) {
        if ( !receiptNumber ) {
          return null;
        }

        return `${WEBSITE_URL}/en-US/payment/${id}`;
      },
    }, {
      field: 'ninja-invoice',
      type: 'String',
      get(object) {
        if (object.ninjaId !== null) {
          return `${INVOICENINJA_URL}/invoices/${object.ninjaId}/edit`;
        }

        return null;
      },
    }, {
      field: 'Refunds',
      type: ['String'],
      reference: 'Credit.id',
    }],
    actions: [{
      name: 'Generate Invoice',
    }, {
      name: 'Cancel Order',
    }, {
      name: 'Send Rent Request',
    }],
    segments: TRASH_SEGMENTS,
  };
};
