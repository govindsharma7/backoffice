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

function fixtures({models, common = Promise.resolve({}), options: globalOptions = {}}) {
  const instances = {};
  let unique;
  let data;

  return function(callback) {
    return function(fileOptions = {}) {
      return common
        .then(({ instances: ins, unique: u }) => {
          const options = Object.assign({
            method: 'create',
            hooks: false,
          }, globalOptions, fileOptions);

          Object.assign(instances, ins);
          unique = new Unique(u);
          /* eslint-disable promise/no-callback-in-promise */
          data = Object.entries(callback(unique));
          /* eslint-enable promise/no-callback-in-promise */

          return Promise.reduce(data, (prev, [modelName, records]) => {
            const model = models[modelName];
            const primaryKeys = Object.keys(model.primaryKeys);
            const modelOptions = Object.assign(
              {},
              options,
              { hooks: options.hooks === modelName || options.hooks === true }
            );

            /* eslint-disable promise/no-nesting */
            return Promise.resolve()
              .then(() =>
                modelOptions.method === 'create' && modelOptions.hooks === false ?
                  model.bulkCreate(records, options) :
                  Promise.map(records, (record) =>
                    model[options.method](record, modelOptions)
                      .then((result) => {
                        if (typeof result === 'object') {
                          return result;
                        }

                        const instance = model.build(record);

                        instance.isNewRecord = false;
                        return instance;
                      })
                  )
              )
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
        })
        .catch((error) => {
          // error must be logged here, otherwise tests fails and Jest doesn't
          // log the full error.
          console.error(error);
          throw error;
        });
    };
  };
}

module.exports = fixtures;
