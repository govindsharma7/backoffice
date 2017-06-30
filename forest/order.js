const Liana   = require('forest-express-sequelize');
const {Order} = require('../src/models');
const Utils   = require('../src/utils');
const Ninja   = require('../src/vendor/invoiceninja');
const {
  TRASH_SEGMENTS,
} = require('../src/const');

const memoizer = new Utils.calculatedPropsMemoizer(Order);

Liana.collection('Order', {
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
        return `${Ninja.URL}/invoices/${object.ninjaId}/edit`;
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
  }],
  segments: TRASH_SEGMENTS,
});
