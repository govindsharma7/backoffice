#!/usr/bin/env node

const Promise = require('bluebird');
const models  = require('../src/models');

const { Apartment } = models;

fixLatLng();

async function fixLatLng() {
  const apartments = await Apartment.findAll({ where: { latLng: { $eq: null } } });

  console.log(apartments.length);

  return Promise.map(
    apartments,
    async (apartment) => {
      await apartment.calculateLatLng();
      return apartment.save();
    },
    { concurrency: 3 }
  );
}
