module.exports = function(promise) {
  return promise
    .thenReturn(true)
    .tapCatch(console.error);
};
