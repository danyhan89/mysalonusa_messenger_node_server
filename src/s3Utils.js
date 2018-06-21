const AWS = require("aws-sdk");

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY
};

AWS.config.update(credentials);

const s3 = new AWS.S3();

const Bucket = process.env.AWS_BUCKET;

const deleteObjects = async params => {
  return await new Promise((resolve, reject) => {
    s3.deleteObjects({ Bucket, ...params }, function(err, data) {
      if (err) {
        reject(err);
        return;
      }

      resolve(data);
    });
  });
};

const deleteKey = async key => {
  return await deleteObjects({ Key: key });
};

const deleteKeys = async keys => {
  keys = keys.map(k => ({
    Key: k
  }));
  if (!keys.length) {
    return;
  }
  return await deleteObjects({
    Delete: {
      Objects: keys
    }
  });
};

const putObject = params => {
  return new Promise((resolve, reject) => {
    s3.putObject(
      {
        Bucket,
        ...params
      },
      function(err, response) {
        if (err) {
          return reject(err);
        }

        resolve(response);
      }
    );
  });
};

const getObject = params => {
  return new Promise((resolve, reject) => {
    s3.getObject(
      {
        Bucket,
        ...params
      },
      function(err, response) {
        if (err) {
          return reject(err);
        }

        resolve(response);
      }
    );
  });
};

const listContents = async key => {
  const params = {
    Bucket,
    Prefix: key
  };

  return new Promise((resolve, reject) => {
    s3.listObjects(params, (err, data) => {
      if (err) {
        return reject(err);
      }
      resolve(data.Contents);
    });
  });
};

module.exports = {
  deleteKeys,
  getObject,
  putObject,
  listContents
};
