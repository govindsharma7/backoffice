const stripIndent                  = require('strip-indent');
const addInternalRelationshipRoute = require('./addInternalRelationshipRoute');
const addRestoreAndDestroyRoutes   = require('./addRestoreAndDestroyRoutes');
const calculatedPropsMemoizer      = require('./calculatedPropsMemoizer');
const createSuccessHandler         = require('./createSuccessHandler');
const roundBy100                   = require('./roundBy100');
const findOrCreateSuccessHandler   = require('./findOrCreateSuccessHandler');
const {
  getCheckinFees,
  getCheckoutFees,
}                                  = require('./getCheckinoutPrice');
const getPackPrice                 = require('./getPackPrice');
const getPeriodCoef                = require('./getPeriodCoef');
const getPeriodPrice               = require('./getPeriodPrice');
const getServiceFees               = require('./getServiceFees');
const {
  getCheckinEndDate,
  getCheckoutEndDate,
}                                  = require('./getCheckinoutEndDate');
const getDepositPrice              = require('./getDepositPrice');
const getLateNoticeFees            = require('./getLateNoticeFees');
const getRefundDate                = require('./getRefundDate');
const getRoomSwitchFees            = require('./getRoomSwitchFees');
const isValidPhoneNumber           = require('./isValidPhoneNumber');
const logAndSend                   = require('./logAndSend');
const parseDBDate                  = require('./parseDBDate');
const toSingleLine                 = require('./toSingleLine');
const wrapHookPromise              = require('./wrapHookPromise');

module.exports = {
  addInternalRelationshipRoute,
  addRestoreAndDestroyRoutes,
  calculatedPropsMemoizer,
  createSuccessHandler,
  roundBy100,
  findOrCreateSuccessHandler,
  getCheckinFees,
  getCheckoutFees,
  getPackPrice,
  getPeriodCoef,
  getPeriodPrice,
  getServiceFees,
  getCheckinEndDate,
  getCheckoutEndDate,
  getDepositPrice,
  getLateNoticeFees,
  getRefundDate,
  getRoomSwitchFees,
  isValidPhoneNumber,
  logAndSend,
  parseDBDate,
  toSingleLine,
  stripIndent,
  wrapHookPromise,
};
