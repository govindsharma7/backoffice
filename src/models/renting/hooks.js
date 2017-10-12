//const Promise                    = require('bluebird');
const Utils                      = require('../../utils');
//const SendinBlue                 = require('../../vendor/sendinblue');
//const {SENDINBLUE_TEMPLATE_ID}   = require('../../const');

module.exports = function(models, Renting) {
  Renting.hook('beforeValidate', (renting) => {
    // Only calculate the price and fees on creation
    if (
      !( 'RoomId' in renting.dataValues ) ||
      !( 'bookingDate' in renting.dataValues ) ||
      ( renting.price != null && renting.price > 0 && !isNaN(renting.price) )
    ) {
      return renting;
    }

    return models.Room.scope('apartment')
      .findById(renting.RoomId)
      .then((room) => {
        return renting.calculatePriceAndFees(room);
      });
  });

  // We want rentings to be draft by default, but users shouldn't have
  // to set the deletedAt value themselves
//  Renting.hook('beforeCreate', (renting) => {
//    if ( renting.status !== 'active' ) {
//      renting.setDataValue('deletedAt', new Date());
//    }
//
//    return renting;
//  });

  // Create quote orders if the housing pack has been set when creating the renting
  Renting.hook('afterCreate', (_renting, { transaction }) => {
    if (_renting.comfortLevel) {
      const promise = Renting.scope('room+apartment', 'clientPaymentMetadata')
        .findById(_renting.id, { transaction })
        .then((renting) => {
          return renting.createQuoteOrders(_renting);
        });

      return Utils.wrapHookPromise(promise);
    }

    return null;
  });

//  Renting.hook('beforeUpdate', (_renting) => {
//    if ( _renting.dataValues.status === 'active' &&
//        _renting._previousDataValues.status !== _renting.dataValues.status) {
//      return Renting.scope(['room+apartment', 'client'])
//        .findById(_renting.id)
//        .then((renting) => {
//          return Promise.all([
//            SendinBlue.serializeWelcomeEmail(renting),
//            renting.Client.preferredLanguage,
//            ]);
//        })
//        .then(([data, language]) => {
//          data.attributes.ROOM = language === 'fr' ? data.attributes.ROOM.fr :
//          data.attributes.ROOM.en;
//
//          return SendinBlue.sendEmail(SENDINBLUE_TEMPLATE_ID.welcome[language], data);
//      });
//    }
//
//    return true;
//  });
};
