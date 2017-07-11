const rValidPhoneNumber = /^(\+|0{2})\d{5,}$/;

module.exports = function(phoneNumber) {
  return rValidPhoneNumber.test(phoneNumber);
};

module.exports.rValidPhoneNumber = rValidPhoneNumber;
