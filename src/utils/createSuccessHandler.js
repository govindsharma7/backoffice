const stripIndent = require('strip-indent');

module.exports = function(res, subject) {
  return (result) => {
    const count = Array.isArray(result) ? result.length : 1;

    res.status(200).send({ success: stripIndent(`\
      ${count} ${subject}${count > 1 ? 's' : ''}\
      ${count > 0 ? ' successfully' : ''} created`
    )});
  };
};
