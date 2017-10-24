const SendinBlueApi = require('sib-api-v3-sdk');
const capitalize    = require('lodash/capitalize');
const D             = require('date-fns');
const fr         = require('date-fns/locale/fr');
const config        = require('../config');
const {
  SUPPORT_EMAIL,
  SPECIAL_CHECKIN_PRICES,
  AGENCY_ADDRESSES,
  DEPOSIT_PRICES,
}                   = require('../const');
const {
  NODE_ENV,
  SENDINBLUE_TEMPLATE_IDS,
  SENDINBLUE_LIST_IDS,
  WEBSITE_URL,
}                   = require('../config');

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
    { emailTo: NODE_ENV === 'production' ?
      data.emailTo : getSandboxEmail(data.emailTo),
    }
  );

  if (options.emailTo.length > 0) {
    return SMTPApi.sendTemplate(id, options)
      .then(() => {
        return true ;
      });
  }

  return true;
}

// In any environment but production, we always replace the email domain
// with our own, to make sure we never send an email to a real client
function getSandboxEmail(email) {
  return `lrbabe+${email.replace(/@(.*)\.[^.]+$/, '_at_$1')}@chez-nestor.com`;
}

function getContact(email) {
  return ContactsApi.getContactInfo(email);
}

function createContact(email, {client, listIds}) {
  return ContactsApi.createContact({
    email: NODE_ENV === 'production' ? email : getSandboxEmail(email),
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

function sendWelcomeEmail(renting) {
  return SendinBlueApi.sendEmail(
    SENDINBLUE_TEMPLATE_IDS.welcome[renting.Client.preferredLanguage],
    serializeWelcomeEmail(renting)
  );
}

function serializeWelcomeEmail(renting) {
  const { Client, Room: { Apartment }, Room } = renting;
  const { name, addressStreet, addressZip, addressCity } = Apartment;
  const isStudio = name.split(' ').splice(-1)[0] === 'studio';
  const roomNumber = Room.reference.slice(-1);

  return {
    emailTo: [Client.email],
    attributes: {
      APARTMENT: `${addressStreet}, ${_.capitalize(addressCity)}, ${addressZip}`,
      FIRSTNAME: _.capitalize(Client.firstName),
      BOOKINGDATE: D.format(renting.bookingDate, 'DD/MM/YYYY'),
      RENT: (renting.price / 100) + (renting.serviceFees / 100),
      EMAIL: Client.email,
      DEPOSIT: DEPOSIT_PRICES[addressCity] / 100,
      ADDRESSAGENCY: AGENCY_ADDRESSES[addressCity],
      SPECIALCHECKIN: SPECIAL_CHECKIN_PRICES[addressCity] / 100,
      ROOM: renting.Client.preferredLanguage === 'en' ?
        ( isStudio ? 'our studio<b>' : `bedroom nº<b>${roomNumber}` ) :
        ( isStudio ? 'l\'appartement entier<b>' : `la chambre nº<b>${roomNumber}` ),
    },
  };
}

function sendRentReminder(order, amount) {
  const { Client } = order;

  return sendEmail(
    SENDINBLUE_TEMPLATE_IDS.dueDate[Client.preferredLanguage],
    {
      emailTo: [Client.email],
      attributes: {
        FIRSTNAME: Client.firstName,
        MONTH: Client.preferredLanguage === 'en' ?
          D.format(order.dueDate, 'MMMM') :
          D.format(order.dueDate, 'MMMM', {locale: fr}),
        AMOUNT: amount / 100,
        LINK: `${WEBSITE_URL}/${Client.preferredLanguage}/payment/${order.id}`,
      },
  });
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
  sendWelcomeEmail,
  sendRentReminder,
  pingService,
};
