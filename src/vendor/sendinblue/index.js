const SendinBlueApi = require('sendinblue-apiv3');
const config        = require('../../config');
const {
  SUPPORT_EMAIL,
}                   = require('../../const');


const defaultClient = SendinBlueApi.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];

apiKey.apiKey = config.SENDINBLUE_API_KEY;

const SMTPApi = new SendinBlueApi.SMTPApi();


let commonData = {
  replyTo: SUPPORT_EMAIL,
};

function sendEmail(id, data = {}) {
  const email = Object.assign({}, commonData, data);
console.log(email);
//  if (email.emailTo.length > 0) {
//  return SMTPApi.sendTemplate(id, email)
//    .then(() => {
//      return true ;
//    });
//  }

  return true;
}

module.exports = {
  sendEmail,
};
