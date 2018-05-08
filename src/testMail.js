const sendMail = require("./sendMail");

sendMail({
  subject: "testmail",
  to: "danyhan89@gmail.com",
  html: "test <b>mail</b>"
});
