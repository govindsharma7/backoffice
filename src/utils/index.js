const stripIndent                  = require('strip-indent');
const addInternalRelationshipRoute = require('./addInternalRelationshipRoute');
const addRestoreAndDestroyRoutes   = require('./addRestoreAndDestroyRoutes');
const calculatedPropsMemoizer      = require('./calculatedPropsMemoizer');
const successHandler               = require('./successHandler');
const roundBy100                   = require('./roundBy100');
const foundOrCreatedSuccessHandler = require('./foundOrCreatedSuccessHandler');
const {
  getCheckinPrice,
  getCheckoutPrice,
}                                  = require('./getCheckinoutPrice');
const getPackPrice                 = require('./getPackPrice');
const getPeriodCoef                = require('./getPeriodCoef');
const getPeriodPrice               = require('./getPeriodPrice');
const getServiceFees               = require('./getServiceFees');
const {
  getCheckinEndDate,
  getCheckoutEndDate,
}                                  = require('./getCheckinoutEndDate');
const getInvoiceLink               = require('./getInvoiceLink');
const getLateNoticeFees            = require('./getLateNoticeFees');
const getLeaseEndDate              = require('./getLeaseEndDate');
const getRoomSwitchPrice           = require('./getRoomSwitchPrice');
const isHoliday                    = require('./isHoliday');
const isValidPhoneNumber           = require('./isValidPhoneNumber');
const logAndSend                   = require('./logAndSend');
const parseDBDate                  = require('./parseDBDate');
const toSingleLine                 = require('./toSingleLine');
const wrapHookPromise              = require('./wrapHookPromise');
const serializeHousemate           = require('./serializeHousemate');

const createdSuccessHandler        = successHandler('created');
const sentSuccessHandler           = successHandler('sent');

module.exports = {
  addInternalRelationshipRoute,
  addRestoreAndDestroyRoutes,
  calculatedPropsMemoizer,
  createdSuccessHandler,
  roundBy100,
  foundOrCreatedSuccessHandler,
  getCheckinPrice,
  getCheckoutPrice,
  getPackPrice,
  getPeriodCoef,
  getPeriodPrice,
  getServiceFees,
  getCheckinEndDate,
  getCheckoutEndDate,
  getInvoiceLink,
  getLateNoticeFees,
  getLeaseEndDate,
  getRoomSwitchPrice,
  isHoliday,
  isValidPhoneNumber,
  logAndSend,
  parseDBDate,
  toSingleLine,
  stripIndent,
  sentSuccessHandler,
  wrapHookPromise,
  serializeHousemate,
};
