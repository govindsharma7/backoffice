module.exports = function(models, Renting) {
  Renting.hook('beforeValidate', (renting) => {
    // Only calculate the price and fees on creation
    if (
      !( 'RoomId' in renting.dataValues ) ||
      !( 'bookingDate' in renting.dataValues ) ||
      ( renting.price != null && !isNaN(renting.price) )
    ) {
      return renting;
    }

    return models.Room.scope('apartment')
      .findById(renting.RoomId)
      .then((room) => {
        return room.getCalculatedProps(renting.bookingDate);
      })
      .then(({periodPrice, serviceFees}) => {
        renting.setDataValue('price', periodPrice);
        renting.setDataValue('serviceFees', serviceFees);
        return renting;
      });
  });

  // We want rentings to be draft by default, but users shouldn't have
  // to set the deletedAt value themselves
//  Renting.hook('beforeCreate', (renting) => {
//    if ( renting.status !== 'active' ) {
//      renting.setDataValue('deletedAt', Date.now());
//    }
//
//    return renting;
//  });

  // Create quote orders if the housing pack has been set when creating the renting
  Renting.hook('afterCreate', (_renting) => {
    if (_renting.comfortLevel) {
      return Renting.scope('room+apartment')
        .findById(_renting.id)
        .then((renting) => {
          return renting.createQuoteOrders(_renting);
        });
    }

    return null;
  });
};
