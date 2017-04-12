#!/usr/bin/env node

const WPAPI = require('wpapi');
const _ = require('lodash');

WPAPI.discover('http://localhost:8080/wp-json')
  .then((nestor) => {
    return recursePaginate(
      nestor.property().embed()
    );
  })
  .then(parseProperties)
  // .then((properties) => {
  //   console.log(properties.length);
  //   throw new Error();
  // })
  .then((portfolio) => {
    console.log(JSON.stringify({
      model: 'Room',
      length: Object.keys(portfolio.rooms).length,
      records: _.sortBy(_.values(portfolio.rooms), ['id']),
    }, null, '  '));

    console.log(JSON.stringify({
      model: 'Apartment',
      length: Object.keys(portfolio.apartments).length,
      records: _.sortBy(_.values(portfolio.apartments), ['id']),
    }, null, '  '));
  })
  .catch((err) => {
    console.error(err);
    throw err;
  });

function recursePaginate(request) {
  return request.then(function( response ) {
    if ( ! response._paging || ! response._paging.next ) {
      return response;
    }
    // Request the next page and return both responses as one collection
    return Promise.all([
      response,
      recursePaginate( response._paging.next ),
    ]).then(function( responses ) {
      return _.flatten( responses );
    });
  });
}

const fixedNames = {
  '1638 2': '59 saint anne 1',
  '4946 2': '156 gambetta 3',
  '4230 2': '40 verdun',
};

function parseProperties(properties) {
  return properties.reduce((portfolio, property) => {

    let address =
      property.meta.estate_property_google_maps[0]
        .match(/address".*?"([^,]+).*?lat".*?"([^"]+).*?lng".*?"([^"]+)/);
    let addressStreet =
      address[1];
    let addressNumber =
      address[1].match(/^\s*(\d+)/)[1];
    let propertyLocation =
      property._embedded['wp:term'][0][0];
    let propertyLocationSlug;
    let addressCity;
    let addressArrdt;
    let apartmentRef =
      property.meta.estate_property_id[0].slice(0,-1);
    let apartmentName =
      property.slug.replace(/-chambre.*/, '').replace(/-/g,' ');
    let addressZip;

    if (
      !/_/.test(propertyLocation) &&
      property._embedded['wp:term'][0][1] !== undefined
    ) {
      propertyLocation = property._embedded['wp:term'][0][1];
    }
    propertyLocationSlug = propertyLocation.slug.split('_');
    addressCity = propertyLocationSlug[0];
    addressArrdt = parseInt(propertyLocationSlug[1]);

    // fix entirely borked names
    if ( apartmentName in fixedNames ) {
      apartmentName = fixedNames[apartmentName];
    }
    // Fix apartment names that don't include the street number
    if ( !/^\d/.test(apartmentName) ) {
      apartmentName = `${addressNumber} ${apartmentName}`;
    }
    // Shorten bis/ter
    apartmentName =
      apartmentName.replace(/ ?(bis|ter) /, (a, b) => {
        return `${b.slice(0,1)} `;
      });
    // Shorten saint
    apartmentName = apartmentName.replace(/ sainte? /, ' st ');
    // Remove useless parts
    apartmentName = apartmentName.replace(/ (rue|boulevard|de baraban) /, ' ');
    // Fix street number appearing after name
    apartmentName = apartmentName.replace(/ (bert|guillotiere) \d+/, ' $1');

    // I gave up fixing the ref system, as it involves modifying
    // labels on the keys
    // // Fix apartment refs that don't include the street number
    // if ( !/^\d/.test(apartmentRef) ) {
    //   apartmentRef = `${addressNumber}${apartmentRef}`;
    // }
    //
    // // numbers are now separated in the reference
    // apartmentRef =
    //   `${addressArrdt || 0}.${addressNumber}${addressAccr}`

    switch (addressCity) {
      case 'lyon':
        addressZip = 69000 + addressArrdt;
        break;
      case 'paris':
        addressZip = 75000 + addressArrdt;
        break;
      case 'montpellier':
        addressZip = 34000;
        break;
      default:
        break;
    }

    if ( !portfolio.apartments[apartmentRef] ) {
      portfolio.apartments[apartmentRef] = {
        id: apartmentRef,
        reference: apartmentRef,
        name: apartmentName,
        addressStreet: addressStreet,
        addressZip: addressZip,
        addressCity: addressCity,
        addressCountry: 'france',
        latLng: `${address[2]},${address[3]}`,
        floorArea: parseFloat(property.meta.estate_property_size[0]),
      };
    }

    let roomRef = property.meta.estate_property_id[0];

    if ( portfolio.rooms[roomRef] !== void 0 ) {
      console.error(`Room reference already exist: ${roomRef}`);
    }
    portfolio.rooms[roomRef] = {
      id: roomRef,
      reference: roomRef,
      name: `${apartmentName} - chambre ${roomRef.slice(-1)}`,
      floorArea: parseFloat(property.meta.additional_estate_property_size_room[0]),
      basePrice: parseFloat(property.meta.estate_property_price[0]) * 100,
      ApartmentId: apartmentRef,
    };

    return portfolio;

  }, { rooms: {}, apartments: {} });
}
