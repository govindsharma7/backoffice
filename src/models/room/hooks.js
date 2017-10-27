module.exports = function(models, Room) {
  Room.hook('beforeCreate', (room) => {
    const { ApartmentId, roomNumber } = room;

    return models.Apartment
      .findById(ApartmentId)
      .then((apartment) => {
        room.setDataValue('reference', `${apartment.reference}${roomNumber}`);
        room.setDataValue('name', `${apartment.name} - chambre ${roomNumber}`);

        if ( !apartment.roomCount || apartment.roomCount < roomNumber ) {
          apartment.update({ roomCount: roomNumber });
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
