const Promise       = require('bluebird');
const { required }  = require('../../utils');

function post(zapId = required(), body = required()) {
  return Promise.resolve(true, zapId, body);
}

module.exports = {
  post,
};
