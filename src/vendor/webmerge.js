const WebmergeApi         = require('webmerge').WebMergePromiseAPI;
const Promise             = require('bluebird');
const capitalize          = require('lodash/capitalize');
const values              = require('lodash/values');
const D                   = require('date-fns');
const { DEPOSIT_PRICES }  = require('../const');
const Utils               = require('../utils');
const config              = require('../config');

const _ = { capitalize, values };
const { required } = Utils;

const webmerge = new WebmergeApi(
  config.WEBMERGE_API_KEY,
  config.WEBMERGE_SECRET,
  Promise
);

function serializeLease(args) {
  const {
    renting = required(),
    client = required(),
    room = required(),
    apartment = required(),
    identityMeta = required(),
    packLevel = required(),
    depositTerm,
    now = new Date(), // used for testing purpose
  } = args;
  const {name, addressStreet, addressZip, addressCity} = apartment;
  const bookingDate = renting.bookingDate || now;
  const identity = JSON.parse(identityMeta.value);
  const fullAddress = _.values(identity.address).filter(Boolean).join(', ');
  const birthDate = _.values(identity.birthDate).join('/');
  const roomNumber = name.split(' ').splice(-1)[0] === 'studio' ?
    'l\'appartement entier' : `la chambre privée nº${room.reference.slice(-1)}`;
  const depositOption = (depositTerm && depositTerm.name === 'do-not-cash') ?
    'de non encaissement du chèque' : 'd\'encaissement du montant';
  let frPackLevel;

  switch (packLevel) {
    case 'comfort':
      frPackLevel = 'Confort';
      break;
    case 'privilege':
      frPackLevel = 'Privilège';
      break;
    default:
      frPackLevel = 'Basique';
      break;
  }

  return {
    fullName: client.fullName,
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
    packLevel: frPackLevel,
    roomNumber,
    roomFloorArea: room.floorArea,
    floorArea: apartment.floorArea,
    address: `${addressStreet}, ${_.capitalize(addressCity)}, ${addressZip}`,
    floor: apartment.floor === 0 ? 'rez-de-chausée' : apartment.floor,
    bookingDate: D.format(bookingDate, 'DD/MM/YYYY'),
    endDate: D.format(Utils.getLeaseEndDate(bookingDate), 'DD/MM/YYYY'),
    email: client.email,
  };
}

function mergeLease(args) {
  return webmerge.mergeDocument(
    config.WEBMERGE_DOCUMENT_ID,
    config.WEBMERGE_DOCUMENT_KEY,
    serializeLease(args),
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
