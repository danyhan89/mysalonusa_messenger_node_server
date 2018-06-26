require("dotenv").config();
const express = require("express");
const app = express();
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
  findState,
  Users
} = require("./models");

const cors = require("cors");
const passport = require("passport");

app.use(
  cors({
    origin: ["http://localhost:8080", "https://broker-wrist-73327.netlify.com"],
    credentials: true, //"Access-Control-Allow-Origin": "http://localhost:8080",
    exposedHeaders: ["Content-Type", "X-Total-Count"]
  })
);

const session = require("express-session");

const cache = {};
passport.serializeUser(function(user, done) {
  // cache[user.uid] = user;
  done(null, user.uid);
});

passport.deserializeUser(function(id, done) {
  //done(null, cache[id] || id);
  //return;
  Users.findOne({ where: { uid: `${id}` } })
    .then(user => {
      done(null, user);
    })
    .catch(err => {
      done(err);
    });
});
const GoogleStrategy = require("passport-google-oauth").OAuth2Strategy;

// Use the GoogleStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and Google
//   profile), and invoke a callback with a user object.
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback"
    },
    function(accessToken, refreshToken, profile, done) {
      const profileEmail = profile.emails[0].value;

      Users.findOrCreate({
        where: { uid: profile.id, email: profileEmail }
      })
        .spread(user => {
          return done(null, user.get({ plain: true }));
        })
        .catch(err => done(err));

      //done(null, profile);
    }
  )
);
const thirty_days = 1000 * 60 * 60 * 24 * 30;

app.use(
  session({
    secret: "keyboard cat",
    cookie: {
      httpOnly: true,
      maxAge: thirty_days
    }
  })
);
app.use(passport.initialize());
app.use(passport.session());
setupRoutes(app);

const socketsPerState = require("./socketsPerState");

const setupStateRoom = ({ id: stateId, name: stateName }) => {
  stateId = stateId.toLowerCase();
  const stateio = io.of("/" + stateId);
  stateio.on("connection", async function(socket) {
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
http.listen(process.env.PORT || 3000, function() {
  console.log("MESSENGER_NODE_URL=" + process.env.MESSENGER_NODE_URL);
  console.log("listening on *:" + process.env.PORT);
});
