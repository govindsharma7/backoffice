const rVisa = /^4[0-9]{12}(?:[0-9]{3})?$/;
const rMastercard =
  /^(?:5[1-5][\d]{2}|222[1-9]|22[3-9][\d]|2[3-6][\d]{2}|27[01][\d]|2720)[\d]{12}$/;

module.exports = function(number) {
  if ( rVisa.test(number) ) {
    return 'visa';
  }

  if ( rMastercard.test(number) ) {
    return 'mastercard';
  }

  return null;
};
