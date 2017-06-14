const Promise   = require('bluebird');
const uuid      = require('uuid/v4');

// Object.entries polyfill
Object.entries = typeof Object.entries === 'function' ?
  Object.entries :
  (obj) => { return Object.keys(obj).map((k) => { return [k, obj[k]]; }); };

function Unique(parent = { l2u: {}, u2l: {} }) {
  this.parent = parent;
  this.l2u = Object.assign({}, parent.l2u);
  this.u2l = Object.assign({}, parent.u2l);
}

Unique.prototype = {
  id(lid) {
    if ( lid in this.l2u ) {
      return this.l2u[lid];
    }

    this.l2u[lid] = uuid();
    this.u2l[this.l2u[lid]] = lid;
    return this.l2u[lid];
  },
  int(lid) {
    if ( lid in this.l2u ) {
      return this.l2u[lid];
    }

    this.l2u[lid] = Math.round(Math.random() * 1E12);
    this.u2l[this.l2u[lid]] = lid;
    return this.l2u[lid];
  },
  str(lid) {
    if ( lid in this.l2u ) {
      return this.l2u[lid];
    }

    this.l2u[lid] = uuid().split('-').shift();
    this.u2l[this.l2u[lid]] = lid;
    return this.l2u[lid];
  },
};

function fixtures({models, common = Promise.resolve({}), options: opts}) {
  const options = Object.assign({
    method: 'create',
    hooks: false,
  }, opts || {});
  const instances = {};
  let unique;
  let data;

  return function(callback) {
    return common
      .then(({ instances: ins, unique: u }) => {
        Object.assign(instances, ins);
        unique = new Unique(u);
        /* eslint-disable promise/no-callback-in-promise */
        data = Object.entries(callback(unique));
        /* eslint-enable promise/no-callback-in-promise */

        return Promise.reduce(data, (prev, [modelName, records]) => {
          const model = models[modelName];
          const primaryKeys = Object.keys(model.primaryKeys);

          /* eslint-disable promise/no-nesting */
          return Promise.resolve()
            .then(() => {
              return options.method === 'create' ?
                model.bulkCreate(records, options) :
                Promise.map(records, (record) => {
                  return model[options.method](record, options)
                    .then((result) => {
                      if (typeof result === 'object') {
                        return result;
                      }

                      const instance = model.build(record);

                      instance.isNewRecord = false;
                      return instance;
                    });
                });
            })
            /* eslint-enable promise/no-nesting */
            .then((results) => {
              if (primaryKeys.length !== 1) {
                return null;
              }

              results.forEach((result) => {
                const id = result[primaryKeys[0]];

                instances[unique.u2l[id] || id] = result;
              });

              return null;
            });
        }, false);
      })
      .then(() => {
        return {instances, unique};
      });
  };
}

module.exports = fixtures;
