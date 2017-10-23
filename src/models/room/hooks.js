module.exports = function(models, Room) {
  Room.hook('beforeCreate', (room) => {
    return models.Apartment
      .findById(room.ApartmentId)
      .then((apartment) => {
      console.log(apartment.roomCount);
      console.log(room.roomNumber);
      console.log(apartment.roomCount < room.roomNumber);
        room.setDataValue(
          'reference',
          `${apartment.reference}${room.roomNumber}`);
        room.setDataValue(
          'name',
          `${apartment.name} - chambre ${room.roomNumber}`);
        if ( !apartment.roomCount || apartment.roomCount < room.roomNumber ) {
          apartment.update({roomCount: room.roomNumber});
        }
        return true;
      });
  });

  Room.hook('beforeDelete', (room) => {
    return models.Client.scope('currentApartment')
      .findAll({
      where: {
        '$Rentings.RoomId$': room.id,
        '$Rentings.bookingDate$': { $lte:  new Date() },
      },
    })
      .then((clients) => {
      if ( clients.length > 0) {
        throw new Error('Cannot delete Room: it\'s not empty.');
      }
      return true;
    });
  });
};
