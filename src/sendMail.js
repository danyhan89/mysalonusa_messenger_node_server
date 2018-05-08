const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(
  process.env.SENDGRID_API_KEY ||
    "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"
);

module.exports = ({ to, from, subject, html }) => {
  const msg = {
    to: to || "danyhan89@gmail.com",
    from: from || "successnailsalon2017@gmail.com",
    subject: subject || "Sending with SendGrid is Fun",

    html: html || "<strong>and easy to do anywhere, even with Node.js</strong>"
  };

  const result = sgMail.send(msg);
  result
    .then(response => {
      console.log("!!!!");
      console.log(response);
    })
    .catch(err => {
      console.log(err);
    });
  console.log(result);
};
