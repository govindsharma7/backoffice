const AWS           = require('aws-sdk');
const Promise       = require('bluebird');
const FormData      = require('form-data');
const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  IMAGE_OPTIM_KEY,
  AWS_BUCKET_PICTURES,
}                   = require('../config');
const { required }  = require('../utils');
const fetch         = require('./fetch');

AWS.config.update({
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  region: AWS_REGION,
  s3ForcePathStyle: true,
});
// Use bluebird Promises, instead of native ones
AWS.config.setPromisesDependency(Promise);

async function uploadFile(bucket = required(), data = required()) {
  const s3Bucket = new AWS.S3( { params: { Bucket: bucket } });
  const { Location } = await s3Bucket.upload(data).promise();

  return Location;
}

async function deleteFile(bucket, data) {
  const s3Bucket = new AWS.S3({ params: { Bucket: bucket } });

  await s3Bucket.deleteObject(data).promise();

  return true;
}

async function deleteFiles(bucket, data) {
  const s3Bucket = new AWS.S3({ params: {Bucket: bucket} });

  await s3Bucket.deleteObjects({ Delete: { Objects: data } }).promise();

  return true;
}

const rBase64Image = /^data:image\/\w+;base64,/;
const rGoogleDriveImage = /^https:\/\/drive.google.com\/file\/d\//;
const picturesBucket = new AWS.S3( { params: { Bucket: AWS_BUCKET_PICTURES } });

async function uploadPicture({ id, url: _url }) {
  let body;
  // replace google drive image urls with the download url
  const url = rGoogleDriveImage.test(_url) ?
    _url.replace(/file\/d\/([^/]+)\/view.*/, 'uc?export=download&id=$1') :
    _url;
  let buffer;

  if ( rBase64Image.test(url) ) {
    body = new FormData();
    buffer = Buffer.from(url.replace(rBase64Image, ''), 'base64');
    body.append('file', buffer, { filename: 'pic.jpg' });
  }

  const fetchUrl =
    `https://im2.io/${IMAGE_OPTIM_KEY}/1920x1080,fit${body ? '' : `/${url}`}`;
  const response = await fetch(fetchUrl, { method: 'post', body });

  if ( response.status >= 400 ) {
    throw new Error(response.statusText);
  }

  const Body = await response.buffer();
  const { Location } = await picturesBucket.upload({
    Key: id,
    Body,
    ACL: 'public-read',
    ContentType: 'image/jpeg',
  }).promise();

  return Location;
}

// This function is used to make sure we have access to the pictures bucket
function pingService() {
  return picturesBucket.headBucket().promise();
}

module.exports = {
  uploadFile,
  deleteFile,
  deleteFiles,
  uploadPicture,
  pingService,
};
