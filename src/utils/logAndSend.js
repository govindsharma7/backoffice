module.exports = function(res) {
  return function(error) {
    console.error(error);
    return res.status(400).send({
      // Payline errors have a longMessage instead of a message :-/
      error: 'longMessage' in error ? error.longMessage : error.message,
    });
  };
};
