const app = require("express")();
const http = require("http").Server(app);
const bodyParser = require("body-parser");
const io = require("socket.io")(http);
const Sequelize = require("sequelize");
const setupRoutes = require("./setupRoutes");
const {
  Chats,
  Communities,
  States,
  sequelize,
  createChatMessage,
  publishChatMessage,
  findState
} = require("./models");

const cors = require("cors");

app.use(cors());
app.use(bodyParser.json());

setupRoutes(app);

const socketsPerState = require("./socketsPerState");

const setupStateRoom = ({ id: stateId, name: stateName }) => {
  stateId = stateId.toLowerCase();
  const stateio = io.of("/" + stateId);
  stateio.on("connection", async function (socket) {
    console.log("a user connected to " + stateName);

    socketsPerState.set(stateId, socket);

    const state = await findState(stateId);
    if (!state) {
      console.error("no state found for ", stateId);
    }
    socketsPerState.set(state.id, socket);

    socket.on("message", async chatMessage => {
      publishChatMessage(JSON.parse(chatMessage));
    });
  });
};

[
  {
    id: "NY",
    name: "New York"
  },
  {
    id: "CA",
    name: "California"
  },
  {
    id: "IL",
    name: "Illinois"
  }
].forEach(setupStateRoom);

app.get("/test", (req, res) => {
  res.json({ hello: "world" });
});
http.listen(process.env.PORT || 3000, function () {
  console.log("MESSENGER_NODE_URL=" + process.env.MESSENGER_NODE_URL);
  console.log("listening on *:" + process.env.PORT);
});
