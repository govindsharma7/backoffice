module.exports = function(res, subject) {
  return function(args) {
    if ( !args[1] ) {
      throw new Error(`${subject} already exists.`);
    }

    res.status(200).send({success: `${subject} successfully created.`});
  };
};
