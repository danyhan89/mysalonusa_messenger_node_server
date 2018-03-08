const Sequelize = require("sequelize");
const socketsPerState = require("./socketsPerState");

const DB_USER = "danyhan";
const DB_PASS = "";
const DB_HOST = "localhost";
const DB_PORT = 5432;
const DB_NAME = "success_mysalonusa_dev";

let DATABASE_URL = process.env.MESSENGER_NODE_URL;
/*
if (DATABASE_URL) {
  DATABASE_URL += "?sslmode=require";
}*/

const sequelize = new Sequelize(
  DATABASE_URL ||
  `postgres://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}`
);

const States = sequelize.define(
  "states", {
    name: Sequelize.STRING
  }, {
    underscored: true
  }
);
const Communities = sequelize.define(
  "communities", {
    name: Sequelize.STRING
  }, {
    underscored: true
  }
);

const Chats = sequelize.define(
  "chats", {
    message: Sequelize.STRING,
    nickname: Sequelize.STRING,
    alias: Sequelize.STRING,
    email: Sequelize.STRING,
    chat_type: {
      type: Sequelize.ENUM,
      values: ["chat", "job"]
    },
    state_id: {
      type: Sequelize.INTEGER,
      references: {
        model: States,
        key: "id"
      }
    },
    community_id: {
      type: Sequelize.INTEGER,
      references: {
        model: Communities,
        key: "id"
      }
    }
  }, {
    underscored: true
  }
);

Chats.hasOne(Communities, {
  foreignKey: "id"
});

const MessengerJobs = sequelize.define(
  "messenger_jobs", {
    description: Sequelize.STRING,
    nickname: Sequelize.STRING,
    alias: Sequelize.STRING,
    email: Sequelize.STRING,
    created_at: Sequelize.DATE,
    views: Sequelize.INTEGER,
    state_id: {
      type: Sequelize.INTEGER,
      references: {
        model: States,
        key: "id"
      }
    },
    community_id: {
      type: Sequelize.INTEGER,
      references: {
        model: Communities,
        key: "id"
      }
    }
  }, {
    underscored: true
  }
);

const findStateByAbbreviation = async abbr => {
  if (typeof abbr != "string") {
    return null;
  }
  const [foundState] = await sequelize.query(
    'SELECT "states".* FROM "states" WHERE (lower(abbreviation) =?)', {
      model: States,
      replacements: [abbr.toLowerCase()]
    }
  );

  return foundState;
};

const STATES = new Map();
const findState = async stateIdOrAbbr => {
  if (STATES.get(stateIdOrAbbr)) {
    return STATES.get(stateIdOrAbbr);
  }

  let state = await findStateByAbbreviation(stateIdOrAbbr);
  if (!state) {
    state = await findStateById(stateIdOrAbbr);
  }
  STATES.set(stateIdOrAbbr, state);

  return state;
};
const findStateById = async id => {
  return await States.findById(id);
};

const publishChatMessage = async chatMessage => {
  const {
    message,
    nickname,
    alias,
    state: stateId,
    community,
    type
  } = chatMessage;

  try {
    let persistedMessage = await createChatMessage({
      message,
      nickname,
      alias,
      type,
      state: stateId,
      community
    }, {
        includeCommunity: false
      });

    const foundCommunity = await Communities.findOne({
      where: {
        name: community
      }
    });

    persistedMessage = JSON.stringify(persistedMessage);
    persistedMessage = JSON.parse(persistedMessage);
    persistedMessage.community = foundCommunity;
    persistedMessage = JSON.stringify(persistedMessage);

    const socket = socketsPerState.get(stateId);

    socket.broadcast.emit("publish", persistedMessage);
    socket.emit("publish", persistedMessage);
  } catch (err) {
    console.error(err);
  }
};

const editChatMessage = async chatMessage => {
  const {
    message,
    nickname,
    alias,
    state_id: stateId,
    community_id: communityId,
    type
  } = chatMessage;

  try {
    await Chats.update({
      message,
      nickname,
      alias,
    }, {
        where: {
          id: chatMessage.id
        }
      });

    persistedMessage = await Chats.findById(chatMessage.id)

    const foundCommunity = await Communities.findOne({
      where: {
        id: communityId
      }
    });

    persistedMessage = JSON.stringify(persistedMessage);
    persistedMessage = JSON.parse(persistedMessage);
    persistedMessage.community = foundCommunity;
    persistedMessage = JSON.stringify(persistedMessage);

    const socket = socketsPerState.get(stateId);

    socket.broadcast.emit("edit", persistedMessage);
    socket.emit("edit", persistedMessage);
  } catch (err) {
    console.error(err);
  }
};


const deleteChatMessage = async id => {

  try {

    const chatMessage = await Chats.findById(id)

    await chatMessage.destroy()

    const socket = socketsPerState.get(chatMessage.state_id);

    socket.broadcast.emit("delete", id);
    socket.emit("delete", id);
  } catch (err) {
    console.error(err);
  }
};


const createChatMessage = async (chatMessage, {
  includeCommunity
} = {}) => {
  const {
    message,
    nickname,
    alias,
    community,
    state,
    type
  } = chatMessage;

  try {
    const foundCommunity = await Communities.findOne({
      where: {
        name: community
      }
    });
    const foundState = await findState(state);

    const createdMessage = await Chats.create({
      message,
      nickname,
      alias,
      chat_type: type == "job" ? 1 : 0, //type || "chat",
      community_id: foundCommunity.id,
      state_id: foundState.id
    }, {
        include: Communities
      });

    if (includeCommunity) {
      createMessage.community = foundCommunity;
    }

    return createdMessage;
  } catch (err) {
    console.error(err);
  }
};
module.exports = {
  States,
  Communities,
  Chats,
  MessengerJobs,
  findState,
  createChatMessage,
  publishChatMessage,
  editChatMessage,
  deleteChatMessage,
  sequelize
};