const Promise   = require('bluebird');
const DeptTree  = require('deptree');
const uuid      = require('uuid/v4');

const rUUID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;

// Object.entries polyfill
Object.entries = typeof Object.entries === 'function' ?
  Object.entries :
  (obj) => Object.keys(obj).map(k => [k, obj[k]]);

function create({models, data, unique, instances: ins, options}) {
  const u2record = {};
  const instances = Object.assign({}, ins);
  const deptree = new DeptTree();

  for (let [modelName, records] of Object.entries(data)) {
    const primaryKey = Object.keys(models[modelName].primaryKeys)[0];

    for (let record of records) {
      let deps = [];

      for (let [key, value] of Object.entries(record)) {
        if ( key !== primaryKey && rUUID.test(value) && !(value in unique.parent.u2l) ) {
          deps.push(value);
        }
      }
      u2record[record[primaryKey]] = { modelName, record };
      deptree.add(record[primaryKey], deps);
    }
  }

  return Promise.reduce(deptree.resolve(), (prev, uid) => {
    const {modelName, record} = u2record[uid];
    const instanceId = unique.u2l[uid] || uid;

    return models[modelName][options.method || 'create'](record, options)
      .then((result) => {
        if (typeof result === 'object') {
          return instances[instanceId] = result;
        }

        // In case of upsert, the instance isn't returned
        // here we can use a query-less alternative to findById
        const instance = models[modelName].build(record);

        instance.isNewRecord = false;
        return instances[instanceId] = instance;
      });
  // records should be loaded in the right order to avoid foreignKey constraints
  // errors
}, false)
  .then(() => {
    return {instances, unique};
  });
}

function Unique(parent = { l2u: {}, u2l: {} }) {
  this.parent = parent;
  this.l2u = Object.assign({}, parent.l2u);
  this.u2l = Object.assign({}, parent.u2l);
}

Unique.hashCode = function() {
	let hash = 0;

	for (let i = 0; i < this.length; i++) {
		let char = this.charCodeAt(i);

		hash = ((hash << 5) - hash) + char;
		hash = hash & hash; // Convert to 32bit integer
	}

	return hash;
};

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

    this.l2u[lid] = uuid().split('-')[0];
    this.u2l[this.l2u[lid]] = lid;
    return this.l2u[lid];
  },
};

function fixtures({models, common = Promise.resolve({}), options: opts}) {
  const options = Object.assign({
    hooks: false,
  }, opts || {});

  return function(callback) {
    return function() {
      return common
        .then(({instances, unique: u}) => {
          const unique = new Unique(u);

          return create({
            models,
            /* eslint-disable promise/no-callback-in-promise */
            data: callback(unique),
            /* eslint-enable promise/no-callback-in-promise */
            unique,
            instances,
            options,
          });
        });
    };
  };
}

module.exports = fixtures;
