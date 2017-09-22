const stripIndent                  = require('strip-indent');
const addInternalRelationshipRoute = require('./addInternalRelationshipRoute');
const addRestoreAndDestroyRoutes   = require('./addRestoreAndDestroyRoutes');
const calculatedPropsMemoizer      = require('./calculatedPropsMemoizer');
const createSuccessHandler         = require('./createSuccessHandler');
const roundBy100                   = require('./roundBy100');
const findOrCreateSuccessHandler   = require('./findOrCreateSuccessHandler');
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
const getLateNoticeFees            = require('./getLateNoticeFees');
const getLeaseEndDate              = require('./getLeaseEndDate');
const getRoomSwitchPrice           = require('./getRoomSwitchPrice');
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
  getCheckinPrice,
  getCheckoutPrice,
  getPackPrice,
  getPeriodCoef,
  getPeriodPrice,
  getServiceFees,
  getCheckinEndDate,
  getCheckoutEndDate,
  getLateNoticeFees,
  getLeaseEndDate,
  getRoomSwitchPrice,
  isValidPhoneNumber,
  logAndSend,
  parseDBDate,
  toSingleLine,
  stripIndent,
  wrapHookPromise,
};
