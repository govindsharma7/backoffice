module.exports = function(model) {
  return /^class extends Model/.test(model.toString());
};
