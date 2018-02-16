module.exports = function(Model, methodName) {
  const instanceName = Model.name.replace(/^./, ($0) => $0.toLowerCase());

  Model.prototype[methodName] = function(args) {
    return Model[methodName](Object.assign({ [instanceName]: this }, args));
  };
};
