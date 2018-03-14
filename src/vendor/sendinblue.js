const Promise       = require('bluebird');
const SendinBlueApi = require('sib-api-v3-sdk');
const _             = require('lodash');
const {
  SUPPORT_EMAIL,
  SENDINBLUE_TEMPLATE_IDS,
  SENDINBLUE_LIST_IDS,
}                   = require('../const');
const Utils         = require('../utils');
const {
  SENDINBLUE_API_KEY,
  NODE_ENV,
  ADMIN_EMAIL,
}                   = require('../config');

SendinBlueApi.ApiClient.instance.authentications['api-key'].apiKey = SENDINBLUE_API_KEY;

const { required } = Utils;

const ContactsApi = new SendinBlueApi.ContactsApi();
const replyTo = SUPPORT_EMAIL;
const Sendinblue = {};

Sendinblue.SMTPApi = new SendinBlueApi.SMTPApi();

Sendinblue.sendTemplateEmail = function(id, data = {}) {
  const isProd = NODE_ENV === 'production';
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
    return Sendinblue.SMTPApi.sendTemplate(isProd ? id : 1, options);
  }

  return Promise.resolve({});
};

Sendinblue.sendAdminNotif = function(content) {
  return Sendinblue.sendTemplateEmail(
    SENDINBLUE_TEMPLATE_IDS.adminNotif,
    { emailTo: [ADMIN_EMAIL], attributes: { CONTENT: content } }
  );
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

Sendinblue.pingService = function() {
  return new SendinBlueApi.AccountApi().getAccount();
};

module.exports = Sendinblue;
