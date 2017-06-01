const fetch        = require('node-fetch');
const urlencode    = require('urlencode');
const config       = require('../../config');


var geocoder = function(apartment) {
  const address = urlencode(`${apartment.addressStreet},
${apartment.addressZip},${apartment.addressCountry}`);
  const url = 'https://maps.googleapis.com/maps/api/geocode/json?';

  return fetch(`${url}address=${address}&key=${config.GOOGLE_MAPS_API_KEY}`);
};


module.exports = geocoder;
