module.exports = function(verb) {
  return (res, subject) =>
    (result) => {
      const count = Array.isArray(result) ? result.length : 1;

      res.status(200).send({ success: [
        `${count} ${subject}${count > 1 ? 's' : ''} `,
        `${count > 0 ? 'successfully' : ''} ${verb}`,
      ].join('')});
    };
};
