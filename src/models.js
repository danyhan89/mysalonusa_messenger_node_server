const Sequelize = require("sequelize");

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
  "states",
  {
    name: Sequelize.STRING
  },
  {
    underscored: true
  }
);
const Communities = sequelize.define(
  "communities",
  {
    name: Sequelize.STRING
  },
  {
    underscored: true
  }
);

const Chats = sequelize.define(
  "chats",
  {
    message: Sequelize.STRING,
    nickname: Sequelize.STRING,
    email: Sequelize.STRING,
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
  },
  {
    underscored: true
  }
);

Chats.hasOne(Communities, {
  foreignKey: "id"
});

const findStateByAbbreviation = async abbr => {
  const [foundState] = await sequelize.query(
    'SELECT "states".* FROM "states" WHERE (lower(abbreviation) =?)',
    { model: States, replacements: [abbr.toLowerCase()] }
  );

  return foundState;
};

module.exports = {
  States,
  Communities,
  Chats,
  findStateByAbbreviation,
  sequelize
};
