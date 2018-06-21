const AWS = require("aws-sdk");
const fs = require("fs");
const log = require("debug")("s3-upload");

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
    const bucketConfig = {
      ContentType: contentType,
      Bucket: process.env.AWS_BUCKET,
      Key: key,
      Body: buffer,
      ACL: "public-read"
    };

    log("Uploading image to S3", bucketConfig);
    s3.putObject(bucketConfig, function(err, data) {
      if (err) {
        log("S3 upload  error", err);
        reject(err);
      } else {
        const fullUrl =
          (process.env.AWS_BUCKET_PUBLIC_URL ||
            `https://s3.amazonaws.com/${process.env.AWS_BUCKET}/`) + key;
        log("Done uploading image to url:", fullUrl);
        resolve(fullUrl);
      }
    });
  });
};
