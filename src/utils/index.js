const addInternalRelationshipRoute        = require('./addInternalRelationshipRoute');
const addRestoreAndDestroyRoutes  = require('./addRestoreAndDestroyRoutes');
const calculatedPropsMemoizer     = require('./calculatedPropsMemoizer');
const createSuccessHandler        = require('./createSuccessHandler');
const roundBy100                  = require('./roundBy100');
const findOrCreateSuccessHandler  = require('./findOrCreateSuccessHandler');
const {
  getCheckinPrice,
  getCheckoutPrice,
}                                 = require('./getCheckinoutPrice');
const getPackPrice                = require('./getPackPrice');
const getPeriodCoef              = require('./getPeriodCoef');
const getPeriodPrice              = require('./getPeriodPrice');
const getServiceFees              = require('./getServiceFees');
const {
  getCheckinEndDate,
  getCheckoutEndDate,
}                                 = require('./getCheckinoutEndDate');
const getLateNoticeFees           = require('./getLateNoticeFees');
const getRoomSwitchPrice          = require('./getRoomSwitchPrice');
const logAndSend                  = require('./logAndSend');
const parseDBDate                 = require('./parseDBDate');
const wrapHookPromise             = require('./wrapHookPromise');
const restoreAndDestroyRoutes     = require('./restoreAndDestroyRoutes');
const checkinoutOrdersRoutes      = require('./checkinoutOrdersRoutes');

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
  getRoomSwitchPrice,
  logAndSend,
  parseDBDate,
  wrapHookPromise,
  restoreAndDestroyRoutes,
  checkinoutOrdersRoutes,
};
