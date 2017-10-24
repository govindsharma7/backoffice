module.exports = function(res) {
  return function(error) {
    console.error(error);
    return res.status(400).send({
      // Payline errors have a longMessage or shortMessage instead of a message :-/
      error: error.longMessage || error.shortMessage || error.message,
    });
  };
};
