const SendinBlueApi = require('sendinblue-apiv3');
const config        = require('../config');
const {
  SUPPORT_EMAIL,
  SENDINBLUE_LIST_IDS,
}                   = require('../const');
const { NODE_ENV }  = require('../config');

SendinBlueApi.ApiClient.instance.authentications['api-key'].apiKey =
  config.SENDINBLUE_API_KEY;

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
  const options = Object.assign({}, defaults, data);

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
      NODE_ENV === 'production' ? '$0' : '_$1@chez-nestor.com'
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

module.exports = {
  sendEmail,
  updateContact,
  createContact,
  getContact,
  serializeClient,
};
