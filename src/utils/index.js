const stripIndent                  = require('strip-indent');
const addInternalRelationshipRoute = require('./addInternalRelationshipRoute');
const addRestoreAndDestroyRoutes   = require('./addRestoreAndDestroyRoutes');
const buildPackItem                = require('./buildPackItem');
const foundOrCreatedSuccessHandler = require('./foundOrCreatedSuccessHandler');
const generateGaleryFields         = require('./generateGaleryFields');
const generateFeaturesFields       = require('./generateFeaturesFields');
const {
  getCheckinPrice,
  getCheckoutPrice,
}                                  = require('./getCheckinoutPrice');
const getCardType                  = require('./getCardType');
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
const methodMemoizer               = require('./methodMemoizer');
const parseDBDate                  = require('./parseDBDate');
const required                     = require('./required');
const roundBy100                   = require('./roundBy100');
const sequelizeSchema              = require('./sequelizeSchema');
const serializeHousemate           = require('./serializeHousemate');
const successHandler               = require('./successHandler');
const toSingleLine                 = require('./toSingleLine');
const wrapHookCallback             = require('./wrapHookCallback');

const createdSuccessHandler        = successHandler('created');
const sentSuccessHandler           = successHandler('sent');

module.exports = {
  addInternalRelationshipRoute,
  addRestoreAndDestroyRoutes,
  buildPackItem,
  createdSuccessHandler,
  foundOrCreatedSuccessHandler,
  generateGaleryFields,
  generateFeaturesFields,
  getCardType,
  getCheckinEndDate,
  getCheckinPrice,
  getCheckoutEndDate,
  getCheckoutPrice,
  getInvoiceLink,
  getLateNoticeFees,
  getLeaseEndDate,
  getPeriodCoef,
  getPeriodPrice,
  getRoomSwitchPrice,
  getServiceFees,
  isHoliday,
  isValidPhoneNumber,
  logAndSend,
  methodMemoizer,
  parseDBDate,
  required,
  roundBy100,
  sentSuccessHandler,
  sequelizeSchema,
  serializeHousemate,
  stripIndent,
  toSingleLine,
  wrapHookCallback,
};
