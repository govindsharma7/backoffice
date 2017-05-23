module.exports = function(res, subject) {
  return () => {
    res.status(200).send({success: `${subject} successfully created`});
  };
};
