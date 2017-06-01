const fetch                 = require('node-fetch');
const urlencode             = require('urlencode');
const {GOOGLE_MAPS_API_KEY} = require('../../config');

const url = 'https://maps.googleapis.com/maps/api/geocode/json';

module.exports = function(_address) {
  const address = urlencode(_address);

  return fetch(`${url}?address=${address}&key=${GOOGLE_MAPS_API_KEY}`);
};
