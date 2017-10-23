const urlencode             = require('urlencode');
const {GOOGLE_MAPS_API_KEY} = require('../config');
const fetch                 = require('./fetch');

const endpoint = 'https://maps.googleapis.com/maps/api/geocode/json';

function geocode(address) {
  return fetch(
      `${endpoint}?address=${urlencode(address)}&key=${GOOGLE_MAPS_API_KEY}`
    )
    .then((res) => {
      return res.json();
    })
    .then((json) => {
      return json.results[0].geometry.location;
    });
}

geocode.pingService = function() {
  return geocode('16 Rue de Condé, 69007, Lyon');
};

module.exports = geocode;
