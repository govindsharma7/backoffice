const Liana   = require('forest-express');
const {Order} = require('../src/models');
const config  = require('../src/config');

const cache = new WeakMap();

// #getCalculatedProps with a WeakMap cache
function getCalculatedProps(object) {
  // It seems sometimes object isn't an Order instance
  if ( !('dataValues' in object) ) {
    return Order.findById(object.id)
      .then((order) => {
        return getCalculatedProps(order);
      });
  }

  if ( cache.has(object) ) {
    return cache.get(object);
  }

  const promise = object.getCalculatedProps();

  cache.set(object, promise);
  return promise;
}

Liana.collection('Order', {
  fields: [{
    field: 'amount',
    type: 'Number',
    get(object) {
      return getCalculatedProps(object)
        .then((result) => {
          return result.amount / 100;
        });
    },
  }, {
    field: 'totalPaid',
    type: 'Number',
    get(object) {
      return getCalculatedProps(object)
        .then((result) => {
          return result.totalPaid / 100;
        });
    },
  }, {
    field: 'balance',
    type: 'Number',
    get(object) {
      return getCalculatedProps(object)
        .then((result) => {
          return result.balance / 100;
        });
    },
  }, {
    field: 'refund',
    type: 'Number',
    get(object) {
      return getCalculatedProps(object)
        .then((result) => {
          return result.refunds / 100;
      });
    },
  }, {
    field: 'invoice',
    type: 'String',
    get(object) {
      if (object.ninjaId !== null) {
        return `${config.INVOICENINJA_HOST}/invoices/${object.ninjaId}/edit`;
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
  }],
});
