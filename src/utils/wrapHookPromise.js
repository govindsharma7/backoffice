module.exports = function(promise) {
  return promise
    .then(() => {
      return true;
    })
    .tapCatch(console.error);
};
