#!/usr/bin/env node

const Promise = require('bluebird');
const models  = require('../src/models');

const { District, Apartment, Room } = models;


District.findAll({
    include: [{
      model: Apartment,
      include: [Room],
    }],
  })
  .mapSeries((district) =>
    Promise.mapSeries(district.Apartments, (apartment) =>
      Promise.all([
        apartment.update({
          descriptionEn: Apartment.generateDescriptionEn({ apartment, district }),
          descriptionFr: Apartment.generateDescriptionFr({ apartment, district }),
        }),
        Promise.map(apartment.Rooms, (room) =>
          room.update({
            descriptionEn: Room.generateDescriptionEn({ room, apartment }),
            descriptionFr: Room.generateDescriptionFr({ room, apartment }),
          })
        ),
      ])
    )
  )
  .then(() => {
    console.log('Descriptions generated !');
    return process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    throw err;
  });
