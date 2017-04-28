 const config = require('../config');

module.exports = function checkToken(req, res, next) {
  if (req.query.secret_token === config.REST_API_SECRET) {
    req.user = true;
  }
  next();
};
