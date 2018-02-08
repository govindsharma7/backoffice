#!/usr/bin/env node

const models  = require('../src/models');

const { Term } = models;

fixEventType();

async function fixEventType() {
  const result = await Term.destroy({
    where: { taxonomy: { $like: '%-features-%' } },
  });

  console.log(result);
}
