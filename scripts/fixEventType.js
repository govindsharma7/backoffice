#!/usr/bin/env node

const Promise = require('bluebird');
const models  = require('../src/models');

const { Event, Term } = models;

fixEventType();

async function fixEventType() {
  const events = await Event.findAll({
    where: { type: { $eq: null } },
    include: [Term],
  });

  console.log(events.length);

  return Promise.map(
    events,
    (event) => event.update({ type: event.Term.name }),
    { concurrency: 3 }
  );
}
