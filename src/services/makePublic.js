module.exports = function(req, res, next) {
  req.user = true;
  next();
};
