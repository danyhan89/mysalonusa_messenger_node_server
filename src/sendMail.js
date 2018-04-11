const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY || "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");

module.exports = ({ to, from, subject, html }) => {

  const msg = {
    to: to || 'danyhan89@gmail.com',
    from: from || 'test@example.com',
    subject: subject || 'Sending with SendGrid is Fun',

    html: html || '<strong>and easy to do anywhere, even with Node.js</strong>',
  };

  const result = sgMail.send(msg);
  result.then(response => {
    
    console.log('!!!!')
    console.log(response)
  }).catch(err => {
    console.log(err)
  })
  console.log(result)
}