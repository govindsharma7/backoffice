const SendinBlueApi = require('sib-api-v3-sdk');
const capitalize    = require('lodash/capitalize');
const D             = require('date-fns');
const config        = require('../config');
const {
  SUPPORT_EMAIL,
  SENDINBLUE_LIST_IDS,
  SPECIAL_CHECKIN_PRICES,
  AGENCY_ADDRESSES,
  DEPOSIT_PRICES,
}                   = require('../const');
const { NODE_ENV }  = require('../config');

SendinBlueApi.ApiClient.instance.authentications['api-key'].apiKey =
  config.SENDINBLUE_API_KEY;

const _ = { capitalize };
const SMTPApi = new SendinBlueApi.SMTPApi();
const ContactsApi = new SendinBlueApi.ContactsApi();
const defaults = { replyTo: SUPPORT_EMAIL };

function serializeClient(client) {
  return {
    FIRSTNAME: client.firstName,
    LASTNAME: client.lastName,
    SMS: client.phoneNumber === null ? null : client.phoneNumber,
  };
}

function sendEmail(id, data = {}) {
  const options = Object.assign(
    {},
    defaults,
    data,
    NODE_ENV !== 'production' ? {emailTo: ['vquesnel@chez-nestor.com']} : {});

  if (options.emailTo.length > 0) {
    return SMTPApi.sendTemplate(id, options)
      .then(() => {
        return true ;
      });
  }

  return true;
}

function getContact(email) {
  return ContactsApi.getContactInfo(email);
}

function createContact(email, {client, listIds}) {
  return ContactsApi.createContact({
    // In any environment but production, we always replace the email domain
    // with our own, to make sure we never send an email to a real client
    email: email.replace(
      /@(.*)\.[^.]+$/,
      NODE_ENV === 'production' ? '$&' : '_$1@chez-nestor.com'
    ),
    attributes: serializeClient(client),
    listIds: listIds === null ?
      [SENDINBLUE_LIST_IDS.prospects[client.preferredLanguage]] : listIds,
  });
}

function updateContact(email, {listIds, unlinkListIds, client}) {
  const params = {
    listIds,
    unlinkListIds,
  };

  if ( client != null ) {
    params.attributes = serializeClient(client);
  }

  return ContactsApi.updateContact(email, params);
}
function serializeWelcomeEmail(renting) {
  const {Apartment} = renting.Room;
  const {name, addressStreet, addressZip, addressCity} = Apartment;

  return {
    emailTo: [renting.Client.email],
    attributes: {
      APARTMENT: `${addressStreet}, ${_.capitalize(addressCity)}, ${addressZip}`,
      FIRSTNAME: _.capitalize(renting.Client.firstName),
      BOOKINGDATE: D.format(renting.bookingDate, 'DD/MM/YYYY'),
      RENT: (renting.price / 100) + (renting.serviceFees / 100),
      EMAIL: renting.Client.email,
      DEPOSIT: DEPOSIT_PRICES[addressCity] / 100,
      ADDRESSAGENCY: AGENCY_ADDRESSES[addressCity],
      SPECIALCHECKIN: SPECIAL_CHECKIN_PRICES[addressCity] / 100,
      ROOM: {
        fr: name.split(' ').splice(-1)[0] === 'studio' ?
        'l\'appartement entier<strong>' :
        `la chambre nº<strong>${renting.Room.reference.slice(-1)}`,
        en: name.split(' ').splice(-1)[0] === 'studio' ?
        'our studio<strong>' : `bedroom nº<strong>${renting.Room.reference.slice(-1)}`,
      },
    },
  };
}

function pingService() {
  return new SendinBlueApi.AccountApi().getAccount();
}

module.exports = {
  sendEmail,
  updateContact,
  createContact,
  getContact,
  serializeClient,
  serializeWelcomeEmail,
  pingService,
};
