module.exports = function(Model, methodName) {
  const instanceName = Model.name.replace(/^./, ($0) => $0.toLowerCase());

  if ( !(methodName in Model) ) {
    throw new Error(`Method "${methodName}" does not exist on "${Model.name}".`);
  }

  Model.prototype[methodName] = function(args) {
    return Model[methodName](Object.assign({ [instanceName]: this }, args));
  };
};
