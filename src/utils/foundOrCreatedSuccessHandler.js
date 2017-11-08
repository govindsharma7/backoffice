module.exports = function(res, subject) {
  return ([, isCreated]) => {
    if (!isCreated) {
      throw new Error(`${subject} already exists.`);
    }

    res.status(200).send({success: `${subject} successfully created.`});
  };
};
