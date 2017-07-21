#!/usr/bin/env node

const Promise   = require('bluebird');
const fetch     = require('node-fetch');
const rooms     = require('../data/rooms.json');

const pictureRegex = /data-src="(.*?)"/g;
var pictures = {};

return Promise
  .map(rooms.records, (room) => {
    return Promise.all([
      fetch(room.url).then((r) => { return r.text(); }),
      room.reference,
    ]);
  }, {concurrency: 10})
  .map(([html, reference]) => {
    let url;

    pictures[reference] = [];
    while ( url = pictureRegex.exec(html) ) {
      pictures[reference].push(
        url[1].replace('http://localhost:8080/wp-content/uploads', '')
      );
    }
    return true;
  })
  .then(() => {
    return console.log(JSON.stringify(pictures, null, '  '));
  });
