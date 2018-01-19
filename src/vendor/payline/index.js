const path        = require('path');
const fs          = require('fs');
const Payline     = require('payline');
const config      = require('../../config');
const { CNError } = require('../../utils');

const wsdlPath = path.resolve(__dirname, 'WebPaymentAPI-v4-production.wsdl');

// Webpack needs a special config to get path.resolve(__dirname, ...) to work
// This test should prevent pushing to prod if that config ever breaks
// (needless to say, if this test throws, removing it isn't the solution!)
if ( !fs.existsSync(wsdlPath) ) {
  throw new Error('Payline\'s WSDL file not found');
}

const payline = new Payline(
  config.PAYLINE_MERCHANT_ID,
  config.PAYLINE_ACCESS_KEY,
  config.PAYLINE_CONTRACT_NUMBER,
  config.NODE_ENV === 'production' ? wsdlPath : undefined
);

function pingService() {
  try {
    return payline.getWallet(123456);
  }
  catch (error) {
    if ( error.code !== '02532' ) {
      console.error(error);
      throw error;
    }

    return true;
  }
}

const errorCodesMap = {
  '01100': 'payment.doNotHonor',
  '01200': 'payment.doNotHonor',
  '01101': 'payment.cardExpired',
  '01201': 'payment.cardExpired',
  '01103': 'payment.unauthorized',
  '01108': 'payment.conditions',
  '01111': 'payment.invalidCardNumber',
  '01113': 'payment.expensesNotAccepted',
  '01116': 'payment.amountLimit',
  '01118': 'payment.cardNotRegistered',
  '01130': 'payment.invalidCVV',
  '01206': 'payment.tooManyAttempts',
};

async function doPurchase(id, card, amount) {
  try {
    return await payline.doPurchase(id, card, amount);
  }
  // Convert a payline error to a CNError
  catch (error) {
    throw new CNError(error.longMessage, {
      code: errorCodesMap[error.code] || 'payment.unexpected',
    });
  }
}

module.exports = {
  payline,
  pingService,
  doPurchase,
  // TODO: translate error codes for these methods?
  doCredit: (creditId, card, amount, currency) =>
    payline.doCredit(creditId, card, amount, currency),
  doRefund: (paymentId, amount) =>
    payline.doRefund(paymentId, amount),
};
