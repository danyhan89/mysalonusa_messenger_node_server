const app = require("express")();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const Sequelize = require("sequelize");
const setupRoutes = require("./setupRoutes");
const {
  Chats,
  Communities,
  States,
  sequelize,
  findStateByAbbreviation
} = require("./models");

const cors = require("cors");

app.use(cors());

setupRoutes(app);

const setupStateRoom = ({ id: stateId, name: stateName }) => {
  stateId = stateId.toLowerCase();
  const stateio = io.of("/" + stateId);
  stateio.on("connection", async function(socket) {
    console.log("a user connected to " + stateName);

    socket.emit(
      "publish",
      JSON.stringify({
        olderMessages: []
      })
    );

    const state = await findStateByAbbreviation(stateId);
    if (!state) {
      console.error("no state found for ", stateId);
    }
    socket.on("message", async chatMessage => {
      chatMessage = JSON.parse(chatMessage);

      const { message, nickname } = chatMessage;

      try {
        const community = await Communities.findOne({
          where: {
            name: chatMessage.community.name
          }
        });

        let persistedMessage = await Chats.create(
          {
            message,
            nickname,
            community_id: community.id,
            state_id: state.id
          },
          {
            include: Communities
          }
        );

        persistedMessage = JSON.stringify(persistedMessage);
        persistedMessage = JSON.parse(persistedMessage);
        persistedMessage.community = community;
        persistedMessage.type = "chat";
        persistedMessage = JSON.stringify(persistedMessage);

        socket.broadcast.emit("publish", persistedMessage);
        socket.emit("publish", persistedMessage);
      } catch (err) {
        console.error(err);
      }
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
http.listen(3000, function() {
  console.log("listening on *:3000");
});
