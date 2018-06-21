const AWS = require("aws-sdk");
const fs = require("fs");

module.exports = (base64data, { key, contentType }) => {
  if (!key) {
    throw new Error("no key specified!");
  }

  return new Promise((resolve, reject) => {
    var s3 = new AWS.S3();
    const buffer =
      base64data instanceof Buffer
        ? base64data
        : new Buffer(
            base64data.replace(/^data:image\/\w+;base64,/, ""),
            "base64"
          );
    s3.putObject(
      {
        ContentType: contentType,
        Bucket: process.env.AWS_BUCKET,
        Key: key,
        Body: buffer,
        ACL: "public-read"
      },
      function(err, data) {
        if (err) {
          reject(err);
        } else {
          const fullUrl =
            `https://s3.amazonaws.com/${process.env.AWS_BUCKET}/` + key;
          resolve(fullUrl);
        }
      }
    );
  });
};
