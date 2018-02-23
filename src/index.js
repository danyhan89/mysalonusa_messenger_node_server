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
  deleteChatMessage,
  editChatMessage,
  findState
} = require("./models");

const cors = require("cors");

app.use(cors({
  exposedHeaders: [
    'Content-Type', 'X-Total-Count'
  ]
}));
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

    socket.on("editMessage", async chatMessage => {
      editChatMessage(JSON.parse(chatMessage));
    });
    socket.on("deleteMessage", async messageId => {
      deleteChatMessage(JSON.parse(messageId));
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
