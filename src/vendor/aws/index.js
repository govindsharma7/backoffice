const AWS     = require('aws-sdk');
const config  = require('../../config');

const sns = new AWS.SNS({
  apiVersion: config.AWS_SNS_API_VERSION,
  accessKeyId: config.AWS_SNS_ACCESS_KEY_ID,
  secretAccessKey: config.AWS_SNS_SECRET_ACCESS_KEY,
  region: config.AWS_REGION,
});

module.exports = sns;
