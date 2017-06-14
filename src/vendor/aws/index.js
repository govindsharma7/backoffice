const AWS     = require('aws-sdk');
const Promise = require('bluebird');
const D       = require('date-fns');
const config  = require('../../config');

// Use bluebird Promises, not native ones
AWS.config.setPromisesDependency(Promise);

const sns = new AWS.SNS({
  apiVersion: config.AWS_SNS_API_VERSION,
  accessKeyId: config.AWS_SNS_ACCESS_KEY_ID,
  secretAccessKey: config.AWS_SNS_SECRET_ACCESS_KEY,
  region: config.AWS_REGION,
});
const defaultMessageAttributes = {
/* MonthlySpendLimit could be usefull if we want to
  limit sms cost each month

  MonthlySpendLimit: {
    DataType: 'Number',
    StringValue: '30'
  },
*/
  DefaultSenderID: {
    DataType: 'String',
    /* required */
    StringValue: 'ChezNestor',
  },
  DefaultSMSType: {
    DataType: 'String',
    StringValue: 'Transactional',
  },
  DeliveryStatusIAMRole: {
    DataType: 'String',
    StringValue: config.AWS_SNS_Delivery_Status_IAM_Role,
  },
};

function sendSms(phoneNumbers, text, date = Date.now()) {
  return sns
    .createTopic({
      Name: `DATE_${D.format(date, 'YYYY-MM-DD')}_TIME_${D.format(date, 'HH-mm-ss')}`,
    }).promise()
    .then((data) => {
      return Promise.all([
        data.TopicArn, // Pass this on to next steps
        Promise.filter(phoneNumbers, (number) => {
          /* eslint-disable promise/no-nesting */
          return sns
            .checkIfPhoneNumberIsOptedOut({ phoneNumber: number }).promise()
            .then((phoneNumber) => {
              return !phoneNumber.isOptedOut;
            })
            .catch((error) => {
              console.error(error);
              return false;
            });
          /* eslint-enable promise/no-nesting */
        }),
      ]);
    })
    .tap(([TopicArn, validNumbers]) => {
      return Promise.map(validNumbers, (number) => {
        return sns.subscribe({
          Protocol: 'sms',
          Endpoint: number,
          TopicArn,
        }).promise();
      });
    })
    .then(([TopicArn]) => {
      return sns.publish({
        Message: text,
        MessageAttributes: defaultMessageAttributes,
        TopicArn,
      }).promise();
    });
}

module.exports = {
  sendSms,
};
