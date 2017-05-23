const D = require('date-fns');

module.exports = function(sDate) {
  return D.parse(sDate.replace(/ ([Z+-])/, '$1'));
};
