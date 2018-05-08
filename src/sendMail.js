const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

module.exports = ({ to, from, subject, html, body }) => {
  if (!subject) {
    throw new Error("No email subject specified!");
  }
  if (!html && !body) {
    throw new Error("No html or body for the email message");
  }
  const msg = {
    to: to || "danyhan89@gmail.com",
    from:
      from ||
      process.env.FROM_EMAIL_ADDRESS ||
      "successnailsalon2017@gmail.com",
    subject: subject,

    html: html || body
  };

  const result = sgMail.send(msg);
  result
    .then(response => {
      console.log("Email successfully sent to " + to);
    })
    .catch(err => {
      console.log("There was an error sending an email to " + to);
      console.log(err);
    });
};
