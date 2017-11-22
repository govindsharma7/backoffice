/* eslint-disable no-invalid-this */
function calculatedPropsMemoizer(Model) {
  this.Model = Model;
  this.cache = new WeakMap();
}
/* eslint-enable no-invalid-this */

// #getCalculatedProps with a WeakMap cache
calculatedPropsMemoizer.prototype.getCalculatedProps = function(object) {
  if ( this.cache.has(object) ) {
    return this.cache.get(object);
  }

  const promise = object instanceof this.Model ?
    object.getCalculatedProps() :
    // In some Forest views, object isn't a Model instance
    this.Model.findById(object.id).then((instance) => instance.getCalculatedProps());

  this.cache.set(object, promise);

  return promise;
};

module.exports = calculatedPropsMemoizer;
