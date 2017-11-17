const stripIndent                  = require('strip-indent');
const addInternalRelationshipRoute = require('./addInternalRelationshipRoute');
const addRestoreAndDestroyRoutes   = require('./addRestoreAndDestroyRoutes');
const calculatedPropsMemoizer      = require('./calculatedPropsMemoizer');
const foundOrCreatedSuccessHandler = require('./foundOrCreatedSuccessHandler');
const {
  getCheckinPrice,
  getCheckoutPrice,
}                                  = require('./getCheckinoutPrice');
const getCardType                  = require('./getCardType');
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
const required                     = require('./required');
const parseDBDate                  = require('./parseDBDate');
const roundBy100                   = require('./roundBy100');
const serializeHousemate           = require('./serializeHousemate');
const successHandler               = require('./successHandler');
const toSingleLine                 = require('./toSingleLine');
const wrapHookCallback             = require('./wrapHookCallback');

const createdSuccessHandler        = successHandler('created');
const sentSuccessHandler           = successHandler('sent');

module.exports = {
  addInternalRelationshipRoute,
  addRestoreAndDestroyRoutes,
  calculatedPropsMemoizer,
  createdSuccessHandler,
  foundOrCreatedSuccessHandler,
  getCardType,
  getCheckinEndDate,
  getCheckinPrice,
  getCheckoutEndDate,
  getCheckoutPrice,
  getInvoiceLink,
  getLateNoticeFees,
  getLeaseEndDate,
  getPackPrice,
  getPeriodCoef,
  getPeriodPrice,
  getRoomSwitchPrice,
  getServiceFees,
  isHoliday,
  isValidPhoneNumber,
  logAndSend,
  parseDBDate,
  required,
  roundBy100,
  sentSuccessHandler,
  serializeHousemate,
  stripIndent,
  toSingleLine,
  wrapHookCallback,
};
