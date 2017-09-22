#!/usr/bin/env node
const Promise            = require('bluebird');
const fetch              = require('node-fetch');
const uuid               = require('uuid/v4');
const forEach            = require('lodash/forEach');
const find               = require('lodash/find');
const isEqual            = require('lodash/isEqual');
const capitalize         = require('lodash/capitalize');
const intersectionWith   = require('lodash/intersectionWith');
const pull               = require('lodash/pull');
const Aws                = require('../src/vendor/aws');
const rooms              = require('../data/rooms.json');

const _ = { forEach, isEqual, intersectionWith, pull, capitalize, find };
const pictureRegex = /data-src="(.*?)"(?:.*?)title="(.*?)"/g;

var pictures = {};

pictures.Room = {};
pictures.Apartment = {};

return Promise
  .map(rooms.records, (room) => {
    return Promise.all([
      fetch(room.url).then((r) => { return r.text(); }),
      room.reference,
    ]);
  }, {concurrency: 10})
  .map(([html, reference]) => {
    let url;
    const apartmentRef = reference.slice(0, -1);

    pictures.Room[reference] = [];
    if ( !pictures.Apartment[apartmentRef] ) {
      pictures.Apartment[apartmentRef] = [];
    }
    while ( (url = pictureRegex.exec(html)) ) {
      let data = {
        url: url[1].replace('localhost:8080', 'www.chez-nestor.com'),
        alt: _.capitalize(url[2]),
      };

      if ( /(^Ch|pièce|(hd00[8-9]|hd01[0-1]))/i.test(url[2]) ) {
        pictures.Room[reference].push(data);
      }
      else {
        let present = pictures.Apartment[apartmentRef].some((obj) => {
          return obj.url === data.url;
        });

        if ( !present ) {
          pictures.Apartment[apartmentRef].push(data);
        }
      }
    }

    return true;
  })
  .then(() => {
    return dataToJSON(pictures);
  })
  .then((file) => {
    return compressPictures(file);
  });


function dataToJSON(file) {
  var Json = {
    model: 'Picture',
    length: '',
    records: [],
  };

  Object.keys(file).forEach((category) => {
    Object.keys(file[category]).forEach((index) => {
      file[category][index].forEach((picture) => {
        Json.records.push({
          id: uuid(),
          url: picture.url,
          alt: picture.alt,
          PicturableId: index,
          picturable: category,
        });
      });
    });
  });
  Json.length = Json.records.length;

  return Json;
}

function compressPictures(file) {
  Promise.map(file.records, (data, index) => {
    return Aws.uploadPicture(data)
      .then((AwsUrl) => {
        return file.records[index].url = AwsUrl;
      });
  }, { concurrency: 20})
  .then(() => {
    return console.log(JSON.stringify(file, null, '  '));
  })
  .catch((e) => {
    console.log(e);
    return process.exit();
  });
}
