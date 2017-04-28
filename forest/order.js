const Liana = require('forest-express');

const cache = new WeakMap();

// #getCalculatedProps with a WeakMap cache
function getCalculatedProps(object) {
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
  },{
    field: 'totalPaid',
    type: 'Number',
    get(object) {
      return getCalculatedProps(object)
        .then((result) => {
          return result.totalPaid / 100;
        });
    },
  },{
    field: 'balance',
    type: 'Number',
    get(object) {
      return getCalculatedProps(object)
        .then((result) => {
          return result.balance / 100;
        });
    },
  }],
});
