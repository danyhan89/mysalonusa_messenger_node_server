const app = require("express")();
const http = require("http").Server(app);
const io = require("socket.io")(http);

const cors = require("cors");

app.use(cors());

io.on("connection", function(socket) {
  console.log("a user connected");

  socket.on("message", message => {
    console.log(message);
    socket.broadcast.emit("publish", message);
    socket.emit("publish", message);
  });
});

http.listen(3000, function() {
  console.log("listening on *:3000");
});
