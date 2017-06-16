module.exports.restoreSuccessHandler = function(res, subject) {
    res.status(200).send({success: `${subject} successfully restored`});
};

module.exports.destroySuccessHandler = function(res, subject) {
    res.status(200).send({success: `${subject} successfully destroyed`});
};
