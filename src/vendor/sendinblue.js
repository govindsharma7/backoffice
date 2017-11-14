const Promise       = require('bluebird');
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
  SENDINBLUE_TEMPLATE_IDS,
  SENDINBLUE_LIST_IDS,
}                   = require('../const');
const {
  NODE_ENV,
  WEBSITE_URL,
}                   = require('../config');

SendinBlueApi.ApiClient.instance.authentications['api-key'].apiKey =
  config.SENDINBLUE_API_KEY;

const _ = { capitalize };
const SMTPApi = new SendinBlueApi.SMTPApi();
const ContactsApi = new SendinBlueApi.ContactsApi();
const defaults = { replyTo: SUPPORT_EMAIL };
const Sendinblue = {};
let Metadata = null;

Sendinblue.init = function(model) {
  Metadata = model;
};

Sendinblue.sendTemplateEmail = function(id, data = {}) {
  const isProd = NODE_ENV === 'production';
  const isTest = NODE_ENV === 'test';
  const emailTo = data.emailTo.filter(Boolean);
  const options = Object.assign(
    {},
    defaults,
    isProd ? data : { attributes: { ID: id, DATA: JSON.stringify(data, null, '  ') } },
    { emailTo: isProd ? emailTo : emailTo.map(Sendinblue.getSandboxEmail) }
  );

  if (options.emailTo.length > 0) {
    return SMTPApi[isTest ? 'sendTest' : 'sendTemplate'](isProd ? id : 1, options);
  }

  return Promise.resolve({});
};

Sendinblue.serializeClient = function(client) {
  return {
    FIRSTNAME: client.firstName,
    LASTNAME: client.lastName,
    SMS: client.phoneNumber === null ? null : client.phoneNumber,
  };
};

// In any environment but production, we always replace the email domain
// with our own, to make sure we never send an email to a real client
Sendinblue.getSandboxEmail = function(email) {
  return `lrbabe+${email.replace(/@(.*)\.[^.]+$/, '_at_$1')}@chez-nestor.com`;
};

Sendinblue.getContact = function(email) {
  return ContactsApi.getContactInfo(email);
};

Sendinblue.createContact = function(email, {client, listIds}) {
  return ContactsApi.createContact({
    email: NODE_ENV === 'production' ? email : Sendinblue.getSandboxEmail(email),
    attributes: Sendinblue.serializeClient(client),
    listIds: listIds === null ?
      [SENDINBLUE_LIST_IDS.prospects[client.preferredLanguage]] : listIds,
  });
};

Sendinblue.updateContact = function(email, {listIds, unlinkListIds, client}) {
  const params = {
    listIds,
    unlinkListIds,
  };

  if ( client != null ) {
    params.attributes = Sendinblue.serializeClient(client);
  }

  return ContactsApi.updateContact(email, params);
};

Sendinblue.sendWelcomeEmail = function(args) {
  const { rentOrder, depositOrder, client, renting, room, apartment } = args;
  const { name, addressStreet, addressZip, addressCity } = apartment;
  const isStudio = name.split(' ').splice(-1)[0] === 'studio';
  const roomNumber = room.reference.slice(-1);
  const lang = client.preferredLanguage === 'en' ? 'en-US' : 'fr-FR';

  return Sendinblue.sendTemplateEmail(
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
  )
  .then(({ messageId }) =>
    Metadata && Metadata.bulkCreate([rentOrder, depositOrder].map((order) => ({
      name: 'messageId',
      value: `Welcome: ${messageId}`,
      MetadatableId: order.id,
      metadatable: 'Order',
    })))
  );
};

Sendinblue.sendRentReminder = function({ order, client, amount, now = new Date() }) {
  const lang = client.preferredLanguage === 'en' ? 'en-US' : 'fr-FR';
  const templateId = D.getDate(now) === 1 ? 'dueDate' : 'unpaidRent';

  return Sendinblue.sendTemplateEmail(
    SENDINBLUE_TEMPLATE_IDS[templateId][client.preferredLanguage],
    {
      emailTo: [client.email, client.secondaryEmail],
      attributes: {
        NAME: `${client.firstName} ${client.lastName}`,
        MONTH: D.format(order.dueDate, 'MMMM', lang === 'fr-FR' ? { locale: fr } : null ),
        AMOUNT: amount / 100,
        LINK: `${WEBSITE_URL}/${lang}/payment/${order.id}`,
      },
  })
  .then(({ messageId }) =>
    Metadata && Metadata.create({
      name: 'messageId',
      value: `Rent Reminder: ${messageId}`,
      MetadatableId: order.id,
      metadatable: 'Order',
    })
  );
};

Sendinblue.sendRentRequest = function({ order, client, amount }) {
  const lang = client.preferredLanguage === 'en' ? 'en-US' : 'fr-FR';

  return Sendinblue.sendTemplateEmail(
    SENDINBLUE_TEMPLATE_IDS.rentInvoice[client.preferredLanguage],
    {
      emailTo: [client.email, client.secondaryEmail],
      attributes: {
        NAME: `${client.firstName} ${client.lastName}`,
        AMOUNT: amount / 100,
        LINK: `${WEBSITE_URL}/${lang}/payment/${order.id}`,
      },
    }
  )
  .then(({ messageId }) =>
    Metadata && Metadata.create({
      name: 'messageId',
      value: `Rent Request: ${messageId}`,
      MetadatableId: order.id,
      metadatable: 'Order',
    })
  );
};

Sendinblue.sendPaymentConfirmation = function({ order, client, amount }) {
  const lang = client.preferredLanguage === 'en' ? 'en-US' : 'fr-FR';

  return Sendinblue.sendTemplateEmail(
    SENDINBLUE_TEMPLATE_IDS.confirmation[client.preferredLanguage],
    {
      emailTo: [client.email, client.secondaryEmail],
      attributes: {
        NAME: `${client.firstName} ${client.lastName}`,
        AMOUNT: amount / 100,
        LABEL: order.label,
        LINK: Utils.getInvoiceLink({ order, lang }),
      },
    }
  )
  .then(({ messageId }) =>
    Metadata && Metadata.create({
      name: 'messageId',
      value: `Payment confirmation: ${messageId}`,
      MetadatableId: order.id,
      metadatable: 'Order',
    })
  );
};

Sendinblue.sendHousingPackRequest = function({ order, amount, client }) {
  const lang = client.preferredLanguage === 'en' ? 'en-US' : 'fr-FR';

  return Sendinblue.sendTemplateEmail(
    SENDINBLUE_TEMPLATE_IDS.housingPack[client.preferredLanguage],
    {
      emailTo: [client.email, client.secondaryEmail],
      attributes: {
        NAME: `${client.firstName} ${client.lastName}`,
        AMOUNT: amount / 100,
        LINK: `${WEBSITE_URL}/${lang}/payment/${order.id}`,
      },
    }
  )
  .then(({ messageId }) =>
    Metadata && Metadata.create({
      name: 'messageId',
      value: `Pack Request: ${messageId}`,
      MetadatableId: order.id,
      metadatable: 'Order',
    })
  );
};

Sendinblue.sendLateFeesEmail = function({order, amount, orderItems, client}) {
  const lang = client.preferredLanguage === 'en' ? 'en-US' : 'fr-FR';

  return Sendinblue.sendTemplateEmail(
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
  })
  .then(({ messageId }) =>
    Metadata && Metadata.create({
      name: 'messageId',
      value: `Late Fees: ${messageId}`,
      MetadatableId: order.id,
      metadatable: 'Order',
    })
  );
};

Sendinblue.pingService = function() {
  return new SendinBlueApi.AccountApi().getAccount();
};

module.exports = Sendinblue;
