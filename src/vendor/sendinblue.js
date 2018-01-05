const Promise       = require('bluebird');
const SendinBlueApi = require('sib-api-v3-sdk');
const capitalize    = require('lodash/capitalize');
const mapValues     = require('lodash/mapValues');
const D             = require('date-fns');
const fr            = require('date-fns/locale/fr');
const {
  SUPPORT_EMAIL,
  HOME_CHECKIN_FEES,
  SPECIAL_CHECKIN_FEES,
  CHECKIN_FORM_URLS,
  DEPOSIT_PRICES,
  SENDINBLUE_TEMPLATE_IDS,
  SENDINBLUE_LIST_IDS,
}                   = require('../const');
const Utils         = require('../utils');
const {
  SENDINBLUE_API_KEY,
  NODE_ENV,
  WEBSITE_URL,
}                   = require('../config');

SendinBlueApi.ApiClient.instance.authentications['api-key'].apiKey = SENDINBLUE_API_KEY;

const _ = { capitalize, mapValues };
const { required } = Utils;

const SMTPApi = new SendinBlueApi.SMTPApi();
const ContactsApi = new SendinBlueApi.ContactsApi();
const replyTo = SUPPORT_EMAIL;
const Sendinblue = {};
let Metadata = null;

Sendinblue.init = function(model) {
  Metadata = model;
};

Sendinblue.sendTemplateEmail = function(id, data = {}) {
  const isProd = NODE_ENV === 'production';
  const isTest = NODE_ENV === 'test';
  const emailTo = data.emailTo.filter(Boolean);
  const options = {
    emailTo: isProd ? emailTo : emailTo.map(Sendinblue.getSandboxEmail),
    replyTo,
    attributes: isProd ?
      _.mapValues(data.attributes, (value, key) =>
        /LINK$/.test(key) ? value.replace(/^https?:\/\//, '//') : value
      ) :
      { ID: id, DATA: JSON.stringify(data, null, '  ') },
  };

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

Sendinblue.createContact = function(email, args) {
  const { client = required(), listIds } = args;

  return ContactsApi.createContact({
    email: NODE_ENV === 'production' ? email : Sendinblue.getSandboxEmail(email),
    attributes: Sendinblue.serializeClient(client),
    listIds: listIds === null ?
      [SENDINBLUE_LIST_IDS.prospects[client.preferredLanguage]] : listIds,
  });
};

Sendinblue.updateContact = function(email, { listIds, unlinkListIds, client }) {
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
  const {
    rentOrder = required(),
    depositOrder = required(),
    client = required(),
    renting = required(),
    room = required(),
    apartment = required(),
    comfortLevel = required(),
  } = args;
  const { name, addressStreet, addressZip, addressCity } = apartment;
  const isStudio = name.split(' ').splice(-1)[0] === 'studio';
  const roomNumber = room.reference.slice(-1);
  const lang = client.preferredLanguage === 'en' ? 'en-US' : 'fr-FR';
  const free = lang === 'en-US' ? 'free' : 'gratuit';
  const homeCheckinFee = HOME_CHECKIN_FEES[comfortLevel] / 100;
  const specialCheckinFee = SPECIAL_CHECKIN_FEES[comfortLevel] / 100;

  return Sendinblue.sendTemplateEmail(
    SENDINBLUE_TEMPLATE_IDS.welcome2[client.preferredLanguage],
    {
      emailTo: [client.email, client.secondaryEmail],
      attributes: {
        APARTMENT: `${addressStreet}, ${_.capitalize(addressCity)}, ${addressZip}`,
        NAME: client.firstName,
        BOOKINGDATE: D.format(renting.bookingDate, 'DD/MM/YYYY'),
        RENT: (renting.price / 100) + (renting.serviceFees / 100),
        RENT_LINK: `${WEBSITE_URL}/${lang}/payment/${rentOrder.id}`,
        EMAIL: client.email,
        DEPOSIT: DEPOSIT_PRICES[addressCity] / 100,
        DEPOSIT_LINK: `${WEBSITE_URL}/${lang}/payment/${depositOrder.id}`,
        HOME_CHECKIN_FEE: homeCheckinFee ? `${homeCheckinFee}€` : free,
        SPECIAL_CHECKIN_FEE: specialCheckinFee ? `${specialCheckinFee}€` : free,
        IDENTITY_FORM_URL: CHECKIN_FORM_URLS[comfortLevel], // TODO: get rid of this
        CHECKIN_FORM_URL: CHECKIN_FORM_URLS[comfortLevel],
        ROOM: lang === 'en-US' ?
          ( isStudio ? 'the <b>studio</b>' : `<b>bedroom nº${roomNumber}</b>` ) :
          ( isStudio ? 'le <b>studio</b>' : `la <b>chambre nº${roomNumber}</b>` ),
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

Sendinblue.sendRentReminder = function(args) {
  const {
    order = required(),
    client = required(),
    amount = required(),
    now = new Date(),
  } = args;
  const lang = client.preferredLanguage === 'en' ? 'en-US' : 'fr-FR';
  const templateId = D.getDate(now) === 1 ? 'lastRentReminder' : 'rentReminder';

  return Sendinblue.sendTemplateEmail(
    SENDINBLUE_TEMPLATE_IDS[templateId][client.preferredLanguage],
    {
      emailTo: [client.email, client.secondaryEmail],
      attributes: {
        NAME: client.firstName,
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

Sendinblue.sendRentRequest = function(args) {
  const {
    order = required(),
    client = required(),
    amount = required(),
  } = args;
  const lang = client.preferredLanguage === 'en' ? 'en-US' : 'fr-FR';

  return Sendinblue.sendTemplateEmail(
    SENDINBLUE_TEMPLATE_IDS.rentInvoice[client.preferredLanguage],
    {
      emailTo: [client.email, client.secondaryEmail],
      attributes: {
        NAME: client.firstName,
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

Sendinblue.sendPaymentConfirmation = function(args) {
  const {
    order = required(),
    client = required(),
    payment = required(),
  } = args;
  const lang = client.preferredLanguage === 'en' ? 'en-US' : 'fr-FR';

  return Sendinblue.sendTemplateEmail(
    SENDINBLUE_TEMPLATE_IDS.confirmation[client.preferredLanguage],
    {
      emailTo: [client.email, client.secondaryEmail],
      attributes: {
        NAME: client.firstName,
        AMOUNT: payment.amount / 100,
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

Sendinblue.sendHousingPackRequest = function(args) {
  const {
    order = required(),
    client = required(),
    amount = required(),
  } = args;
  const lang = client.preferredLanguage === 'en' ? 'en-US' : 'fr-FR';

  return Sendinblue.sendTemplateEmail(
    SENDINBLUE_TEMPLATE_IDS.housingPack[client.preferredLanguage],
    {
      emailTo: [client.email, client.secondaryEmail],
      attributes: {
        NAME: client.firstName,
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

Sendinblue.sendLateFeesEmail = function(args) {
  const {
    order = required(),
    orderItems = required(),
    client = required(),
    amount = required(),
  } = args;
  const lang = client.preferredLanguage === 'en' ? 'en-US' : 'fr-FR';

  return Sendinblue.sendTemplateEmail(
    SENDINBLUE_TEMPLATE_IDS.lateFees[client.preferredLanguage],
    {
      emailTo: [client.email],
      attributes: {
        FIRSTNAME: client.firstName,
        NAME: client.firstName,
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
