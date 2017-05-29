module.exports = function(promise) {
  return promise
    .then(() => {
      return true;
    })
    .catch(console.error);
};
