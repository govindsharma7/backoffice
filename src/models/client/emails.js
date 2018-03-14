const D                     = require('date-fns');
const fr                    = require('date-fns/locale/fr');
const _                     = require('lodash');
const Sendinblue            = require('../../vendor/sendinblue');
const {
  HOME_CHECKIN_FEES,
  SPECIAL_CHECKIN_FEES,
  CHECKIN_FORM_URLS,
  SENDINBLUE_TEMPLATE_IDS,
}                           = require('../../const');
const { WEBSITE_URL }       = require('../../config');
const Utils                 = require('../../utils');
const models                = require('../models');

const { required } = Utils;
const Client = {};

Client.sendWelcomeEmail = async function(args) {
  const {
    client = required(),
    renting = required(),
    rentOrder = required(),
    depositOrder = required(),
    room = required(),
    apartment = required(),
    packLevel = required(),
    transaction,
  } = args;
  const { name, addressStreet, addressZip, addressCity } = apartment;
  const isStudio = name.split(' ').splice(-1)[0] === 'studio';
  const roomNumber = room.reference.slice(-1);
  const lang = client.locale;
  const free = lang === 'en-US' ? 'free' : 'gratuit';
  const homeCheckinFee = HOME_CHECKIN_FEES[packLevel] / 100;
  const specialCheckinFee = SPECIAL_CHECKIN_FEES[packLevel] / 100;

  const { messageId } = await Sendinblue.sendTemplateEmail(
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
        DEPOSIT: Utils.getDepositPrice({ addressCity }) / 100,
        DEPOSIT_LINK: `${WEBSITE_URL}/${lang}/payment/${depositOrder.id}`,
        HOME_CHECKIN_FEE: homeCheckinFee ? `${homeCheckinFee}€` : free,
        SPECIAL_CHECKIN_FEE: specialCheckinFee ? `${specialCheckinFee}€` : free,
        IDENTITY_FORM_URL: CHECKIN_FORM_URLS[packLevel], // TODO: get rid of this
        CHECKIN_FORM_URL: CHECKIN_FORM_URLS[packLevel],
        ROOM: lang === 'en-US' ?
          ( isStudio ? 'the <b>studio</b>' : `<b>bedroom nº${roomNumber}</b>` ) :
          ( isStudio ? 'le <b>studio</b>' : `la <b>chambre nº${roomNumber}</b>` ),
      },
    }
  );

  return models.Metadata.bulkCreate([rentOrder, depositOrder].map((order) => ({
    name: 'messageId',
    value: `Welcome: ${messageId}`,
    MetadatableId: order.id,
    metadatable: 'Order',
  })), { transaction });
};

Client.sendRentReminder = async function(args) {
  const {
    client = required(),
    order = required(),
    amount = required(),
    now = new Date(),
  } = args;
  const lang = client.locale;
  const templateId = D.getDate(now) === 1 ? 'lastRentReminder' : 'rentReminder';
  const { messageId } = await Sendinblue.sendTemplateEmail(
    SENDINBLUE_TEMPLATE_IDS[templateId][client.preferredLanguage],
    {
      emailTo: [client.email, client.secondaryEmail],
      attributes: {
        NAME: client.firstName,
        MONTH: D.format(order.dueDate, 'MMMM', lang === 'fr-FR' ? { locale: fr } : null ),
        AMOUNT: amount / 100,
        LINK: `${WEBSITE_URL}/${lang}/payment/${order.id}`,
      },
  });

  return models.Metadata.create({
    name: 'messageId',
    value: `Rent Reminder: ${messageId}`,
    MetadatableId: order.id,
    metadatable: 'Order',
  });
};

Client.sendPaymentRequest = async function(args) {
  const {
    client = required(),
    order = required(),
    amount = required(),
    isRent,
  } = args;
  const template = isRent ? 'rentPaymentRequest' : 'paymentRequest';
  const lang = client.locale;

  const { messageId } = await Sendinblue.sendTemplateEmail(
    SENDINBLUE_TEMPLATE_IDS[template][client.preferredLanguage],
    {
      emailTo: [client.email, client.secondaryEmail],
      attributes: {
        NAME: client.firstName,
        LABEL: order.label,
        AMOUNT: amount / 100,
        LINK: `${WEBSITE_URL}/${lang}/payment/${order.id}`,
      },
    }
  );

  return models.Metadata.create({
    name: 'messageId',
    value: `Rent Request: ${messageId}`,
    MetadatableId: order.id,
    metadatable: 'Order',
  });
};

Client.sendPaymentConfirmation = async function(args) {
  const {
    client = required(),
    order = required(),
    payment = required(),
    transaction,
  } = args;
  const lang = client.locale;
  const { messageId } = await Sendinblue.sendTemplateEmail(
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
  );

  return models.Metadata.create({
    name: 'messageId',
    value: `Payment confirmation: ${messageId}`,
    MetadatableId: order.id,
    metadatable: 'Order',
  }, { transaction });
};

Client.sendBookingSummaryEmail = async function(args) {
  const {
    client = required(),
    renting = required(),
    apartment = required(),
    transaction,
  } = args;
  const lang = client.locale;
  const { messageId } = await Sendinblue.sendTemplateEmail(
    SENDINBLUE_TEMPLATE_IDS.bookingSummary[client.preferredLanguage],
    {
      emailTo: [client.email, client.secondaryEmail],
      attributes: {
        NAME: client.firstName,
        APARTMENT: apartment.name,
        LINK: `${WEBSITE_URL}/${lang}/summary/${renting.id}`,
      },
    }
  );

  return models.Metadata.create({
    name: 'messageId',
    value: `Booking Summary: ${messageId}`,
    MetadatableId: renting.id,
    metadatable: 'Renting',
  }, { transaction });
};

Client.sendLateFeesEmail = async function(args) {
  const {
    client = required(),
    order = required(),
    orderItems = required(),
    amount = required(),
  } = args;
  const lang = client.locale;
  const { messageId } = await Sendinblue.sendTemplateEmail(
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
  });

  return models.Metadata.create({
    name: 'messageId',
    value: `Late Fees: ${messageId}`,
    MetadatableId: order.id,
    metadatable: 'Order',
  });
};

module.exports = Client;
