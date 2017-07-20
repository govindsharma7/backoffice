#!/usr/bin/env node

const Promise   = require('bluebird');
const fetch     = require('node-fetch');
const rooms     = require('../data/rooms.json');

const pictureRegex = /data-src="(.*?)"/g;
var pictures = {};

Promise.map(rooms.records, (room) => {
    return Promise.all([
      room.url,
      room.reference,
    ]);
  })
  .then((urls) => {
    return Promise.mapSeries(urls, (url) => {
      return Promise.all([
        fetch(url[0]),
        url[1],
      ]);
    });
  })
  .then((responses) => {
    return Promise.mapSeries(responses, (response) => {
      return Promise.all([
        response[0].text(),
        response[1],
      ]);
    });
  })
  .then((htmls) => {
    return Promise.mapSeries(htmls, (html) => {
      let url;

      pictures[html[1]] = [];
      while ( url = pictureRegex.exec(html[0]) ) {
        pictures[html[1]].push(url[1]);
      }
      console.log(pictures);
      return true;
    });
  });
