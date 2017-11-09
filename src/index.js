const app = require("express")();
const http = require("http").Server(app);
const io = require("socket.io")(http);

const cors = require("cors");

app.use(cors());

const setupCityRoom = (city) => {
  const cityio = io.of('/' + city)
  cityio.on("connection", function (socket) {
    console.log("a user connected to " + city);

    socket.on("message", message => {
      message = JSON.parse(message)
      message.timestamp = Date.now()
      message = JSON.stringify(message)

      socket.broadcast.emit("publish", message);
      socket.emit("publish", message);
    });
  });
}

['NY', 'LA', 'Chicago'].forEach(setupCityRoom);

http.listen(3000, function () {
  console.log("listening on *:3000");
});