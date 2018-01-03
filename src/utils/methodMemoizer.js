module.exports = function({ model, method, args }) {
  const cache = new WeakMap();

  return async (object) => {
    if ( cache.has(object) ) {
      return cache.get(object);
    }

    // In some Forest views, object isn't a model instance
    const instance = object instanceof model ? object : await model.findById(object.id);
    const result = instance[method].apply(instance, args);

    cache.set(object, result);

    return result;
  };
};
