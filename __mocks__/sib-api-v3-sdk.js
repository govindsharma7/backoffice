const Promise = require('bluebird');

function ContactsApi() {
  this.getContactInfo = () => Promise.resolve({ email: 'john-doe@company.com' });
  this.createContact = () => Promise.resolve(true);
  this.updateContact = () => Promise.resolve(true);
}

function SMTPApi() {
  this.sendTemplate = () => Promise.resolve({
    messageId: `payline-${Math.round(Math.random() * 1E9)}`,
  });
}

module.exports = {
  ContactsApi,
  SMTPApi,
  ApiClient: { instance: { authentications: { 'api-key': {} } } },
};
