const {
  TRASH_SEGMENTS,
  INVOICENINJA_URL,
}                   = require('../../const');
const Utils         = require('../../utils');

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
      field: 'invoice',
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
      name: 'Restore Order',
    }, {
      name: 'Destroy Order',
    }, {
      name: 'Cancel Invoice',
    }, {
      name: 'Send Rent Request',
    }],
    segments: TRASH_SEGMENTS,
  };
};
