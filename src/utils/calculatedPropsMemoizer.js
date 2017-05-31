/* eslint-disable no-invalid-this */
function calculatedPropsMemoizer(Model) {
  this.Model = Model;
  this.cache = new WeakMap();
}
/* eslint-enable no-invalid-this */

// #getCalculatedProps with a WeakMap cache
calculatedPropsMemoizer.prototype.getCalculatedProps = function(object) {
  // It seems sometimes object isn't an Model instance
  if ( !('dataValues' in object) ) {
    return this.Model.findById(object.id)
      .then((instance) => {
        return this.getCalculatedProps(instance);
      });
  }

  if ( this.cache.has(object) ) {
    return this.cache.get(object);
  }

  const promise = object
    .getCalculatedProps()
    .tapCatch(console.error);

  this.cache.set(object, promise);
  return promise;
};

module.exports = calculatedPropsMemoizer;
