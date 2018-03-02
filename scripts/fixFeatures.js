#!/usr/bin/env node

const models  = require('../src/models');

const { Term, Apartment } = models;

fixApartmentFeatures();

async function fixApartmentFeatures() {
  const terms = [];
  const apartments = await Apartment.findAll();

  apartments.forEach((apartment) => {
    const baseTerm = {
      termable: 'Apartment',
      TermableId: apartment.id,
      taxonomy: 'apartment-features-kitchen',
    };

    terms.push(
      Object.assign({ name: 'bakingTray' }, baseTerm),
      Object.assign({ name: 'colander' }, baseTerm),
      Object.assign({ name: 'dishwasher' }, baseTerm)
    );
  });

  await Term.bulkCreate(terms);

  console.log(`${terms.length} equipments created`);
}
