const AWS         = require('aws-sdk');
const Promise     = require('bluebird');
const FormData    = require('form-data');
const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  IMAGE_OPTIM_KEY,
  AWS_BUCKET_PICTURES,
}                 = require('../config');
const fetch       = require('./fetch');

AWS.config.update({
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  region: AWS_REGION,
  s3ForcePathStyle: true,
});
// Use bluebird Promises, instead of native ones
AWS.config.setPromisesDependency(Promise);

function uploadFile(bucket, data) {
  const s3Bucket = new AWS.S3( { params: {Bucket: bucket} });

  return s3Bucket.upload(data).promise()
    .then((result) => { return result.Location; });
}

function deleteFile(bucket, data) {
  const s3Bucket = new AWS.S3({ params: {Bucket: bucket} });

  return s3Bucket.deleteObject(data).promise()
    .then(() => { return true; });
}

const rBase64Image = /^data:image\/\w+;base64,/;
const imageBucket = new AWS.S3( { params: { Bucket: AWS_BUCKET_PICTURES } });

function uploadPicture({ id, url }) {
  let body;
  let buffer;

  if ( rBase64Image.test(url) ) {
    body = new FormData();
    buffer = Buffer.from(url.replace(rBase64Image, ''), 'base64');
    body.append('file', buffer, { filename: 'pic.jpg' });
  }

  return fetch(
      `https://im2.io/${IMAGE_OPTIM_KEY}/1920x1080,fit${body ? '' : `/${url}`}`,
      {
        method: 'POST',
        body,
      }
    )
    .then((response) => {
      if ( response.status >= 400 ) {
        throw new Error(response.statusText);
      }

      return response.buffer();
    })
    .then((Body) => {
      return imageBucket.upload({
        Key: id,
        Body,
        ACL: 'public-read',
        ContentType: 'image/jpeg',
      }).promise();
    })
    .then(({ Location }) => { return Location; });
}

/* Following code is deprecated as we're switching to SendInBlue to send
 * emails and SMS
 */
// const sns = new AWS.SNS({
//   apiVersion: AWS_SNS_API_VERSION,
//   accessKeyId: AWS_SNS_ACCESS_KEY_ID,
//   secretAccessKey: AWS_SNS_SECRET_ACCESS_KEY,
//   region: AWS_REGION,
// });
//
// const defaultMessageAttributes = {
// /* MonthlySpendLimit could be usefull if we want to
//   limit sms cost each month
//
//   MonthlySpendLimit: {
//     DataType: 'Number',
//     StringValue: '30'
//   },
// */
//   DefaultSenderID: {
//     DataType: 'String',
//     /* required */
//     StringValue: 'ChezNestor',
//   },
//   DefaultSMSType: {
//     DataType: 'String',
//     StringValue: 'Transactional',
//   },
//   DeliveryStatusIAMRole: {
//     DataType: 'String',
//     StringValue: config.AWS_SNS_Delivery_Status_IAM_Role,
//   },
// };
//
// function sendSms(phoneNumbers, text, date = new Date()) {
//   return sns
//     .createTopic({
//       Name: `DATE_${D.format(date, 'YYYY-MM-DD')}_TIME_${D.format(date, 'HH-mm-ss')}`,
//     }).promise()
//     .then((data) => {
//       return Promise.all([
//         data.TopicArn, // Pass this on to next steps
//         Promise.filter(phoneNumbers, (number) => {
//           /* eslint-disable promise/no-nesting */
//           return sns
//             .checkIfPhoneNumberIsOptedOut({ phoneNumber: number }).promise()
//             .then((phoneNumber) => {
//               return !phoneNumber.isOptedOut;
//             })
//             .catch((error) => {
//               console.error(error);
//               return false;
//             });
//           /* eslint-enable promise/no-nesting */
//         }),
//       ]);
//     })
//     .tap(([TopicArn, validNumbers]) => {
//       return Promise.map(validNumbers, (number) => {
//         return sns.subscribe({
//           Protocol: 'sms',
//           Endpoint: number,
//           TopicArn,
//         }).promise();
//       });
//     })
//     .then(([TopicArn]) => {
//       return sns.publish({
//         Message: text,
//         MessageAttributes: defaultMessageAttributes,
//         TopicArn,
//       }).promise();
//     });
// }

module.exports = {
  // sendSms,
  uploadFile,
  deleteFile,
  uploadPicture,
};
