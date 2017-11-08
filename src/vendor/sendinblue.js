const SendinBlueApi = require('sib-api-v3-sdk');
const capitalize    = require('lodash/capitalize');
const D             = require('date-fns');
const fr            = require('date-fns/locale/fr');
const config        = require('../config');
const Utils          = require('../utils');
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

function sendTemplateEmail(id, data = {}) {
  const isProd = NODE_ENV === 'production';
  const emailTo = data.emailTo.filter(Boolean);
  const options = Object.assign(
    {},
    defaults,
    isProd ? data : { attributes: { ID: id, DATA: JSON.stringify(data, null, '  ') } },
    { emailTo: isProd ? emailTo : emailTo.map(getSandboxEmail) }
  );

  if (options.emailTo.length > 0) {
    return SMTPApi.sendTemplate(isProd ? id : 1, options);
  }

  return false;
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

function sendWelcomeEmail({ rentOrder, depositOrder, client, renting, room, apartment }) {
  const { name, addressStreet, addressZip, addressCity } = apartment;
  const isStudio = name.split(' ').splice(-1)[0] === 'studio';
  const roomNumber = room.reference.slice(-1);
  const lang = client.preferredLanguage === 'en' ? 'en-US' : 'fr-FR';

  return sendTemplateEmail(
    SENDINBLUE_TEMPLATE_IDS.welcome[client.preferredLanguage],
    {
      emailTo: [client.email, client.secondaryEmail],
      attributes: {
        APARTMENT: `${addressStreet}, ${_.capitalize(addressCity)}, ${addressZip}`,
        NAME: `${_.capitalize(client.firstName)} ${client.lastName}`,
        BOOKINGDATE: D.format(renting.bookingDate, 'DD/MM/YYYY'),
        RENT: (renting.price / 100) + (renting.serviceFees / 100),
        RENT_LINK: `${WEBSITE_URL}/${lang}/payment/${rentOrder.id}`,
        EMAIL: client.email,
        DEPOSIT: DEPOSIT_PRICES[addressCity] / 100,
        DEPOSIT_LINK: `${WEBSITE_URL}/${lang}/payment/${depositOrder.id}`,
        ADDRESSAGENCY: AGENCY_ADDRESSES[addressCity],
        SPECIALCHECKIN: SPECIAL_CHECKIN_PRICES[addressCity] / 100,
        ROOM: client.preferredLanguage === 'en' ?
          ( isStudio ? 'our studio<b>' : `bedroom nº<b>${roomNumber}` ) :
          ( isStudio ? 'l\'appartement entier<b>' : `la chambre nº<b>${roomNumber}` ),
      },
    }
  );
}

function sendRentReminder({ order, client, amount, now = new Date() }) {
  const lang = client.preferredLanguage === 'en' ? 'en-US' : 'fr-FR';
  const templateId = D.getDate(now) === 1 ? 'dueDate' : 'unpaidRent';

  return sendTemplateEmail(
    SENDINBLUE_TEMPLATE_IDS[templateId][client.preferredLanguage],
    {
      emailTo: [client.email, client.secondaryEmail],
      attributes: {
        NAME: `${client.firstName} ${client.lastName}`,
        MONTH: D.format(order.dueDate, 'MMMM', lang === 'fr-FR' ? { locale: fr } : null ),
        AMOUNT: amount / 100,
        LINK: `${WEBSITE_URL}/${lang}/payment/${order.id}`,
      },
  });
}

function sendRentRequest({ order, client, amount }) {
  const lang = client.preferredLanguage === 'en' ? 'en-US' : 'fr-FR';

  return sendTemplateEmail(
    SENDINBLUE_TEMPLATE_IDS.rentInvoice[client.preferredLanguage],
    {
      emailTo: [client.email, client.secondaryEmail],
      attributes: {
        NAME: `${client.firstName} ${client.lastName}`,
        AMOUNT: amount / 100,
        LINK: `${WEBSITE_URL}/${lang}/payment/${order.id}`,
      },
    }
  );
}

function sendConfirmationPayment({ order, client, amount }) {
  const lang = client.preferredLanguage === 'en' ? 'en-US' : 'fr-FR';

  return sendTemplateEmail(
    SENDINBLUE_TEMPLATE_IDS.confirmation[client.preferredLanguage],
    {
      emailTo: [client.email, client.secondaryEmail],
      attributes: {
        NAME: `${client.firstName} ${client.lastName}`,
        AMOUNT: amount / 100,
        LABEL: order.label,
        LINK: Utils.getInvoiceLink({ order, lang }),
      },
    });
}

function sendHousingPackRequest({ order, amount, client }) {
  const lang = client.preferredLanguage === 'en' ? 'en-US' : 'fr-FR';

  return sendTemplateEmail(
    SENDINBLUE_TEMPLATE_IDS.housingPack[client.preferredLanguage],
    {
      emailTo: [client.email, client.secondaryEmail],
      attributes: {
        NAME: `${client.firstName} ${client.lastName}`,
        AMOUNT: amount / 100,
        LINK: `${WEBSITE_URL}/${lang}/payment/${order.id}`,
      },
    }
  );
}

function sendLateFeesEmail({order, amount, orderItems, client}) {
  const lang = client.preferredLanguage === 'en' ? 'en-US' : 'fr-FR';

  return sendTemplateEmail(
    SENDINBLUE_TEMPLATE_IDS.lateFees[client.preferredLanguage],
    {
      emailTo: [client.email],
      attributes: {
        FIRSTNAME: client.firstName,
        MONTH: D.format(order.dueDate, 'MMMM', lang === 'fr-FR' ? { locale: fr } : null ),
        AMOUNT: amount / 100,
        LATE_FEES: orderItems[0].unitPrice * orderItems[0].quantity / 100,
        LINK: `${WEBSITE_URL}/${lang}/payment/${order.id}`,
      },
  });
}

function pingService() {
  return new SendinBlueApi.AccountApi().getAccount();
}

module.exports = {
  sendTemplateEmail,
  updateContact,
  createContact,
  getContact,
  serializeClient,
  sendWelcomeEmail,
  sendRentReminder,
  sendRentRequest,
  sendHousingPackRequest,
  sendConfirmationPayment,
  sendLateFeesEmail,
  pingService,
};
