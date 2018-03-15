const _ = require('lodash');

const rMayBeUuid = /-[\dA-F]{4}-/i;
const rUuid = /[\dA-F]{8}(?:-[\dA-F]{4}){3}-[\dA-F]{12}/i;

function stripUuidRecursive(value) {
  if ( typeof value === 'object' && Array.isArray(value) ) {
    return value.map(stripUuidRecursive);
  }
  else if ( typeof value === 'object' ) {
    return _.mapValues(value, stripUuidRecursive);
  }
  else if ( typeof value === 'string' && rMayBeUuid.test(value) ) {
    return value.replace(rUuid, 'SNAPSHOTABLE-UUID');
  }
  return value;
}

module.exports = function(spiedFn) {
  return stripUuidRecursive(spiedFn.mock.calls.slice(-1)[0]);
};
