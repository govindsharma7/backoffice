const Promise   = require('bluebird');
const DeptTree  = require('deptree');
const uuid      = require('uuid/v4');

const rUUID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;

// Object.entries polyfill
Object.entries = typeof Object.entries === 'function' ?
  Object.entries :
  (obj) => Object.keys(obj).map(k => [k, obj[k]]);

function create(models, data, unique, options) {
  const u2record = {};
  const instances = {};
  const deptree = new DeptTree();

  for (let [modelName, records] of Object.entries(data)) {
    for (let record of records) {
      let deps = [];

      for (let [key, value] of Object.entries(record)) {
        if ( key !== 'id' && rUUID.test(value) && !(value in unique.parent.u2l) ) {
          deps.push(value);
        }
      }
      u2record[record.id] = { modelName, record };
      deptree.add(record.id, deps);
    }
  }

  return deptree.resolve()
    .map((uid) => {
      return () => {
        const {modelName, record} = u2record[uid];

        return models[modelName]
          .create(record, options)
          .then((instance) => {
            instances[unique.u2l[uid]] = instance;
          });
      };
    })
    .reduce((prev, curr) => {
      return prev.then(curr);
    }, Promise.resolve(true))
    .then(() => {
      return {instances, unique};
    });
}

function Unique(parent = { l2u: {}, u2l: {} }) {
  this.parent = parent;
  this.l2u = Object.assign({}, parent.l2u);
  this.u2l = Object.assign({}, parent.u2l);
}

Unique.hashCode = function(){
	let hash = 0;

	for (let i = 0; i < this.length; i++) {
		let char = this.charCodeAt(i);

		hash = ((hash<<5)-hash)+char;
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

function defaultCommon() {
  return Promise.resolve({});
}

function fixtures(models, common = defaultCommon, _options = {}) {
  const options = Object.assign({
    hooks: false,
  }, _options);

  return function(callback) {
    return function() {
      return common()
        .then(({unique}) => {
          const _u = new Unique(unique);

          return create(
            models,
            callback(_u),
            _u,
            options
          );
        });
    };
  };
}

module.exports = fixtures;
