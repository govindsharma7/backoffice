const WebmergeApi = require('webmerge').WebMergePromiseAPI;
const Promise     = require('bluebird');
const capitalize  = require('lodash/capitalize');
const values     = require('lodash/values');
const D           = require('date-fns');
const Utils       = require('../utils');
const config      = require('../config');
const {
  LEASE_DURATION,
  DEPOSIT_PRICES,
}                 = require('../const');

const _ = { capitalize, values };

const webmerge = new WebmergeApi(
  config.WEBMERGE_API_KEY,
  config.WEBMERGE_SECRET,
  Promise
);

function serializeLease(renting) {
  const {Client, Terms, Room} = renting;
  const {Apartment} = Room;
  const {name, addressStreet, addressZip, addressCity} = Apartment;
  const bookingDate = renting.bookingDate || new Date();
  const identity = JSON.parse(Client.Metadata[0].value);
  const fullAddress = _.values(identity.address).filter(Boolean).join(', ');
  const birthDate = _.values(identity.birthDate).join('/');
  const roomNumber = name.split(' ').splice(-1)[0] === 'studio' ?
    'l\'appartement entier' : `la chambre privée nº${Room.reference.slice(-1)}`;
  const depositOption = !Terms[0] || (Terms[0] && Terms[0].name === 'cash') ?
    'd\'encaissement du montant' : 'de non encaissement du chèque';
  let packLevel;

  switch (renting.get('comfortLevel')) {
    case 'comfort':
      packLevel = 'Confort';
      break;
    case 'privilege':
      packLevel = 'Privilège';
      break;
    default:
      packLevel = 'Basique';
      break;
  }

  return Promise.resolve({
    fullName: `${Client.firstName} ${Client.lastName.toUpperCase()}`,
    fullAddress,
    birthDate,
    birthPlace: Utils.toSingleLine(`
      ${identity.birthPlace.first}
      (${_.capitalize(identity.birthCountryFr)})
    `),
    nationality: identity.nationalityFr,
    rent: renting.price / 100,
    serviceFees: renting.serviceFees / 100,
    deposit: DEPOSIT_PRICES[addressCity] / 100,
    depositOption,
    packLevel,
    roomNumber,
    roomFloorArea: Room.floorArea,
    floorArea: Apartment.floorArea,
    address: `${addressStreet}, ${_.capitalize(addressCity)}, ${addressZip}`,
    floor: Apartment.floor === 0 ? 'rez-de-chausée' : Apartment.floor,
    bookingDate: D.format(bookingDate, 'DD/MM/YYYY'),
    endDate: D.format(D.addMonths(
      D.subDays(bookingDate, 1), LEASE_DURATION), 'DD/MM/YYYY'),
    email: Client.email,
  });
}

function mergeLease(data) {
  return webmerge.mergeDocument(
    config.WEBMERGE_DOCUMENT_ID,
    config.WEBMERGE_DOCUMENT_KEY,
    data,
    config.NODE_ENV !== 'production' // webmerge's test environment switch
  );
}

function pingService() {
  return webmerge.getDocument(config.WEBMERGE_DOCUMENT_ID);
}

module.exports = {
  serializeLease,
  mergeLease,
  pingService,
};
