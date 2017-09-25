const SendinBlueApi = require('sendinblue-apiv3');
const config        = require('../../config');
const {
  SUPPORT_EMAIL,
  SENDINBLUE_LIST_ID,
}                   = require('../../const');

const defaultClient = SendinBlueApi.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];

apiKey.apiKey = config.SENDINBLUE_API_KEY;

const SMTPApi = new SendinBlueApi.SMTPApi();

const ContactsApi = new SendinBlueApi.ContactsApi();

let commonData = {
  replyTo: SUPPORT_EMAIL,
};

function sendEmail(id, data = {}) {
  const email = Object.assign({}, commonData, data);

  if (email.emailTo.length > 0) {
    return SMTPApi.sendTemplate(id, email)
      .then(() => {
        return true ;
      });
  }

  return true;
}

function getContact(email) {
  return ContactsApi.getContactInfo(email);
}

function createContact(client, listIds) {
  return ContactsApi.createContact({
    email: client.email,
    attributes: {
      NOM: client.lastName,
      PRENOM: client.firstName,
      SMS: client.phoneNumber ? client.phoneNumber : null,
    },
    listIds: listIds === null ?
    [SENDINBLUE_LIST_ID.prospects[client.preferredLanguage]] : listIds,
  });
}

function updateContact(email, listIds, unlinkListIds, attributes = {}) {
  return ContactsApi.updateContact(email, {
    listIds,
    unlinkListIds,
    attributes,
  });
}

module.exports = {
  sendEmail,
  updateContact,
  createContact,
  getContact,
};
