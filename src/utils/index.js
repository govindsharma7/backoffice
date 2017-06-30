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
}                                  = require('./getCheckinoutFees');
const getPackPrice                 = require('./getPackPrice');
const getDepositPrice              = require('./getDepositPrice');
const getPeriodCoef                = require('./getPeriodCoef');
const getPeriodPrice               = require('./getPeriodPrice');
const getServiceFees               = require('./getServiceFees');
const {
  getCheckinEndDate,
  getCheckoutEndDate,
}                                  = require('./getCheckinoutEndDate');
const getLateNoticeFees            = require('./getLateNoticeFees');
const getRoomSwitchFees           = require('./getRoomSwitchFees');
const logAndSend                   = require('./logAndSend');
const parseDBDate                  = require('./parseDBDate');
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
  getDepositPrice,
  getPeriodCoef,
  getPeriodPrice,
  getServiceFees,
  getCheckinEndDate,
  getCheckoutEndDate,
  getLateNoticeFees,
  getRoomSwitchFees,
  logAndSend,
  parseDBDate,
  stripIndent,
  wrapHookPromise,
};
