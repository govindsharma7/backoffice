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
    (event) => (
      event.Terms[0] && event.update({ type: event.Terms[0].name })
    ),
    { concurrency: 3 }
  );
}
