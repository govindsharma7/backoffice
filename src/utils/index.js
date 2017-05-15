const {
  getCheckinPrice,
  getCheckoutPrice,
}                     = require('./getCheckinoutPrice');
const getPackPrice    = require('./getPackPrice');
const getPeriodCoef   = require('./getPeriodCoef');
const getServiceFees  = require('./getServiceFees');

module.exports = {
  getCheckinPrice,
  getCheckoutPrice,
  getPackPrice,
  getPeriodCoef,
  getServiceFees,
};
