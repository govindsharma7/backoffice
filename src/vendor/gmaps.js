const urlencode               = require('urlencode');
const { GOOGLE_MAPS_API_KEY } = require('../config');
const fetch                   = require('./fetch');

const endpoint = 'https://maps.googleapis.com/maps/api/geocode/json';

async function geocode(address) {
  const result = await fetch(
    `${endpoint}?address=${urlencode(address)}&key=${GOOGLE_MAPS_API_KEY}`
  );
  const json = await result.json();

  return json.results[0].geometry.location;
}

function pingService() {
  return geocode('16 Rue de Condé, 69002, Lyon');
}

module.exports = {
  geocode,
  pingService,
};
