#!/usr/bin/env node

/* eslint-disable import/no-dynamic-require */
const path    = require('path');
const Promise = require('bluebird');
const models  = require('../src/models');
const Utils   = require('../src/utils');

// Object.entries polyfill
Object.entries = typeof Object.entries === 'function' ?
  Object.entries :
  (obj) => { return Object.keys(obj).map((k) => { return [k, obj[k]]; }); };

if (
  process.env.NODE_ENV !== 'test' &&
  process.env.NODE_ENV !== 'development' &&
  !process.argv.includes('--force')
) {
  throw new Error(`
/!\\ WARNING /!\\
This script will erase all your data!
Use "--force" if you're certain you want to do that.
  `);
}

/* eslint-disable promise/no-nesting */
return models.sequelize.sync({ force: true })
  .then(() => {
    // We used to just load all files in the folder, but the order we load them
    // is important because of references constraints
    const tuples = [
      'apartments.json',
      'rooms.json',
      'clients.json',
      'products.json',
      'rentings.json',
      'settings.json',

    ].map((file) => {
      const {model, records} = require(path.join('..', 'data', file));
      let hasRefError = false;

      if ( /^(rooms|clients)/.test(file) ) {
        models[model].recordMap = {};

        records.forEach((record) => {
          models[model].recordMap[record.id] = record;
        });
      }

      if ( /^rentings/.test(file) ) {
        records.forEach((record) => {
          if ( !(record.ClientId in models.Client.recordMap ) ) {
            hasRefError = true;
            console.error(`Client ${record.ClientId} not found in clients.json`);
          }
          if ( !(record.RoomId in models.Room.recordMap ) ) {
            hasRefError = true;
            console.error(`Room ${record.RoomId} not found in rooms.json`);
          }
        });
      }

      if ( hasRefError ) {
        throw new Error('rentings.json contains error. Stopping here');
      }

      return {model, records};
    });

    const eventsTuple = {
      model: 'Event',
      records: [],
    };
    const termsTuple = {
      model: 'Term',
      records: [],
    };

    (tuples.find(({model}) => {
      return model === 'Renting';
    })).records.forEach((record) => {
      record.id = `${record.ClientId}-${record.RoomId}`;

      if ( record.checkoutDate == null ) {
        return;
      }

      const eventId = `${record.id}>checkout`;

      eventsTuple.records.push({
        id: eventId,
        startDate: record.checkoutDate,
        eventable: 'Renting',
        EventableId: record.id,
      });

      termsTuple.records.push({
        taxonomy: 'event-category',
        name: 'checkout',
        TermableId: eventId,
        termable: 'Event',
      });
    });

    tuples.push(eventsTuple, termsTuple);

    return Promise.reduce(tuples, (prev, {model, records}) => {
      return Promise.resolve(records)
        .then((records) => {
          if ( model !== 'Renting' ) {
            return records;
          }

          return Promise.map(records, (record) => {
            return models.Room.scope('Room.Apartment')
              .findById(record.RoomId)
              .then((room) => {
                return Utils.getServiceFees(room.get('roomCount'));
              })
              .then((serviceFees) => {
                record.serviceFees = serviceFees;
                return record;
              });
          });
        })
        .then((records) => {
          console.log(`Loading ${records.length} records of model "${model}"`);
          return models[model].bulkCreate(records, { hooks: false });
        })
        .catch((err) => {
          console.error(`Failed loading records for model "${model}"`);
          if ( 'errors' in err ) {
            console.log(err.errors);
          }

          throw err;
        });
    }, false);
  })
  .then(() => {
    console.log('DATABASE SUCCESSFULLY FIXTURED!');
    return process.exit(0);
  });
