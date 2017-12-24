module.exports = function(Model, methodName) {
  const cache = new WeakMap();

  return (object) => {
    if ( cache.has(object) ) {
      return cache.get(object);
    }

    const promise = object instanceof Model ?
      object[methodName]() :
      // In some Forest views, object isn't a Model instance
      Model.findById(object.id).then((instance) => instance[methodName]());

    cache.set(object, promise);

    return promise;
  };
};
