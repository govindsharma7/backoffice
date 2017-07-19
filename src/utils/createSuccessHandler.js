const toSingleLine = require('./toSingleLine');

module.exports = function(res, subject) {
  return (result) => {
    const count = Array.isArray(result) ? result.length : 1;

    res.status(200).send({ success: toSingleLine(`\
      ${count} ${subject}${count > 1 ? 's' : ''}\
      ${count > 0 ? ' successfully' : ''} created`
    )});
  };
};
