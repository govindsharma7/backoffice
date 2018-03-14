const Promise       = require('bluebird');
const { required }  = require('../../utils');

module.exports = {
  post(zapId = required(), body = required) {
    return Promise.resolve(true, zapId, body);
  },
  postRentInvoiceSuccess() {
    return Promise.resolve(true);
  },
};
